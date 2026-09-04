import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { actualsToSave } = data; // Array<{ shift_id: number, actual_start_time: string, actual_end_time: string, break_hours: number }>

    if (!Array.isArray(actualsToSave) || actualsToSave.length === 0) {
      return NextResponse.json({ message: '保存対象のデータがありません。', count: 0 });
    }

    // トランザクションの開始
    await query('BEGIN');

    let count = 0;

    for (const item of actualsToSave) {
      const { shift_id, actual_start_time, actual_end_time, break_hours } = item;

      if (!shift_id) continue;

      // 該当シフトと従業員の時給を取得
      const shiftRes = await query(
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
      const parsedBreak = Number(break_hours);
      const breakHoursToSave = (!isNaN(parsedBreak) && parsedBreak >= 0) ? parsedBreak : 0;

      // すでに actual_work_hours が存在するかチェック
      const existingRes = await query(
        'SELECT id FROM actual_work_hours WHERE shift_id = $1',
        [shift_id]
      );

      if (existingRes.rows.length > 0) {
        // 更新
        await query(
          `UPDATE actual_work_hours 
           SET actual_start_time = $1, actual_end_time = $2, break_hours = $3, hourly_wage = $4
           WHERE shift_id = $5`,
          [actual_start_time || null, actual_end_time || null, breakHoursToSave, hourly_wage, shift_id]
        );
      } else {
        // 新規登録
        await query(
          `INSERT INTO actual_work_hours (shift_id, actual_start_time, actual_end_time, break_hours, hourly_wage)
           VALUES ($1, $2, $3, $4, $5)`,
          [shift_id, actual_start_time || null, actual_end_time || null, breakHoursToSave, hourly_wage]
        );
      }
      count++;
    }

    await query('COMMIT');

    return NextResponse.json({ message: '一括保存に成功しました。', count });

  } catch (error) {
    try {
      await query('ROLLBACK');
    } catch (rbErr) {
      console.error('Rollback failed:', rbErr);
    }
    console.error('Failed to save actuals batch:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: '実績一括保存に失敗しました。', details: errorMessage }, { status: 500 });
  }
}
