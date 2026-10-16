import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';
import { checkRole, SessionUser } from '@/lib/auth';
import { calcDuration, defaultBreakHours, parseBreakHours, todayInJapan } from '@/lib/worktime';

/**
 * 実績を操作してよいか確認する。管理者は常にOK。
 * 従業員は自分のシフトで、かつ今日以前の日付のものだけ操作できる。
 */
async function loadShiftForUser(shiftId: number, user: SessionUser) {
  const { rows } = await query(
    `SELECT s.id, s.employee_id, to_char(s.date, 'YYYY-MM-DD') AS date, e.hourly_wage
     FROM shifts s JOIN employees e ON s.employee_id = e.id WHERE s.id = $1`,
    [shiftId]
  );
  const shift = rows[0];
  if (!shift) return { error: NextResponse.json({ error: 'Invalid shift_id' }, { status: 404 }) };
  if (user.role !== 'admin') {
    if (shift.employee_id !== user.id) {
      return { error: NextResponse.json({ error: '他の人の実績は操作できません。' }, { status: 403 }) };
    }
    if (shift.date > todayInJapan()) {
      return { error: NextResponse.json({ error: '未来の日付の実績は入力できません。' }, { status: 403 }) };
    }
  }
  return { shift };
}

// POST handler to create or update actual work hours
export async function POST(request: Request) {
  const auth = await checkRole(request, 'admin', 'employee');
  if (auth instanceof NextResponse) return auth;

  try {
    const data = await request.json();
    const { shift_id, actual_start_time, actual_end_time, break_hours } = data;

    if (!shift_id || !actual_start_time || !actual_end_time) {
      return NextResponse.json({ error: 'Shift ID and start/end times are required' }, { status: 400 });
    }

    const { shift, error } = await loadShiftForUser(shift_id, auth);
    if (error) return error;

    const hourlyWage = shift.hourly_wage;
    if (typeof hourlyWage !== 'number') {
      return NextResponse.json({ error: 'Could not find hourly wage for employee' }, { status: 404 });
    }

    // 休憩が送られてこなければ共通ルールで決める
    const breakHoursToSave = parseBreakHours(break_hours)
      ?? defaultBreakHours(calcDuration(actual_start_time, actual_end_time));

    // 時給は「保存した時点の時給」を記録する
    const existing = await query('SELECT id FROM actual_work_hours WHERE shift_id = $1', [shift_id]);
    if (existing.rows.length > 0) {
      await query(
        'UPDATE actual_work_hours SET actual_start_time = $1, actual_end_time = $2, break_hours = $3, hourly_wage = $4 WHERE shift_id = $5',
        [actual_start_time, actual_end_time, breakHoursToSave, hourlyWage, shift_id]
      );
    } else {
      await query(
        'INSERT INTO actual_work_hours (shift_id, actual_start_time, actual_end_time, break_hours, hourly_wage) VALUES ($1, $2, $3, $4, $5)',
        [shift_id, actual_start_time, actual_end_time, breakHoursToSave, hourlyWage]
      );
    }

    return NextResponse.json({ message: 'Actual hours saved successfully' }, { status: 200 });

  } catch (error) {
    console.error('Failed to save actual hours:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to save actual hours', details: errorMessage }, { status: 500 });
  }
}

// DELETE handler to remove actual work hours
export async function DELETE(request: Request) {
  const auth = await checkRole(request, 'admin', 'employee');
  if (auth instanceof NextResponse) return auth;

  try {
    const data = await request.json();
    const { shift_id } = data;

    if (!shift_id) {
      return NextResponse.json({ error: 'Shift ID is required' }, { status: 400 });
    }

    const { error } = await loadShiftForUser(shift_id, auth);
    if (error) return error;

    await query('DELETE FROM actual_work_hours WHERE shift_id = $1', [shift_id]);
    return NextResponse.json({ message: 'Actual hours deleted successfully' }, { status: 200 });

  } catch (error) {
    console.error('Failed to delete actual hours:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to delete actual hours', details: errorMessage }, { status: 500 });
  }
}
