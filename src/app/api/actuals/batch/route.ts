import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { checkRole } from '@/lib/auth';
import { calcDuration, defaultBreakHours, parseBreakHours } from '@/lib/worktime';

// 管理者による実績の一括保存。全件成功か全件取り消しのどちらかになる（トランザクション）。
export async function POST(request: Request) {
  const auth = await checkRole(request, 'admin');
  if (auth instanceof NextResponse) return auth;

  let actualsToSave: { shift_id: number; actual_start_time: string; actual_end_time: string; break_hours: number }[];
  try {
    ({ actualsToSave } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(actualsToSave) || actualsToSave.length === 0) {
    return NextResponse.json({ message: '保存対象のデータがありません。', count: 0 });
  }

  // トランザクションは「同じ接続」で BEGIN〜COMMIT する必要があるため、接続を1本確保して使う
  const client = await getDb().connect();
  try {
    await client.query('BEGIN');
    let count = 0;

    for (const item of actualsToSave) {
      const { shift_id, actual_start_time, actual_end_time, break_hours } = item;
      if (!shift_id) continue;
      if (!actual_start_time || !actual_end_time) {
        throw new Error(`開始・終了時刻が未入力の実績があります（シフトID: ${shift_id}）`);
      }

      const shiftRes = await client.query(
        `SELECT s.id, e.hourly_wage
         FROM shifts s
         JOIN employees e ON s.employee_id = e.id
         WHERE s.id = $1`,
        [shift_id]
      );
      if (shiftRes.rows.length === 0) {
        throw new Error(`該当するシフトIDが見つかりません: ${shift_id}`);
      }

      const hourly_wage = shiftRes.rows[0].hourly_wage;
      const breakHoursToSave = parseBreakHours(break_hours)
        ?? defaultBreakHours(calcDuration(actual_start_time, actual_end_time));

      const existingRes = await client.query('SELECT id FROM actual_work_hours WHERE shift_id = $1', [shift_id]);
      if (existingRes.rows.length > 0) {
        await client.query(
          `UPDATE actual_work_hours
           SET actual_start_time = $1, actual_end_time = $2, break_hours = $3, hourly_wage = $4
           WHERE shift_id = $5`,
          [actual_start_time, actual_end_time, breakHoursToSave, hourly_wage, shift_id]
        );
      } else {
        await client.query(
          `INSERT INTO actual_work_hours (shift_id, actual_start_time, actual_end_time, break_hours, hourly_wage)
           VALUES ($1, $2, $3, $4, $5)`,
          [shift_id, actual_start_time, actual_end_time, breakHoursToSave, hourly_wage]
        );
      }
      count++;
    }

    await client.query('COMMIT');
    return NextResponse.json({ message: '一括保存に成功しました。', count });

  } catch (error) {
    await client.query('ROLLBACK').catch((rbErr: unknown) => console.error('Rollback failed:', rbErr));
    console.error('Failed to save actuals batch:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: '実績一括保存に失敗しました。', details: errorMessage }, { status: 500 });
  } finally {
    client.release();
  }
}
