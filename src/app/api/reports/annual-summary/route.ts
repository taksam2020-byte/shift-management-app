import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';

// GET handler to fetch annual summary for all employees for a given year
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
  }

  try {
    // 実績がある場合は実績を、ない場合は予定を取得する。時給は実績があれば実績から、なければ従業員マスタから取る。
    const sql = `
      SELECT 
        s.employee_id,
        s.start_time,
        s.end_time,
        a.actual_start_time,
        a.actual_end_time,
        a.break_hours,
        COALESCE(a.hourly_wage, e.hourly_wage) as hourly_wage
      FROM shifts s
      JOIN employees e ON s.employee_id = e.id
      LEFT JOIN actual_work_hours a ON s.id = a.shift_id
      WHERE s.date >= $1
        AND s.date <= $2
    `;
    const result = await query(sql, [startDate, endDate]);

    const incomeByEmployee: { [key: number]: number } = {};

    for (const record of result.rows) {
      const { employee_id, start_time, end_time, actual_start_time, actual_end_time, break_hours, hourly_wage } = record;

      let workHours = 0;

      if (actual_start_time && actual_end_time) {
        // --- 1. 実績がある場合 ---
        const start = new Date(`1970-01-01T${actual_start_time}Z`);
        const end = new Date(`1970-01-01T${actual_end_time}Z`);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            let duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            if (duration < 0) duration += 24; // 日またぎ対応
            workHours = Math.max(0, duration - (break_hours || 0));
        }
      } else if (start_time && end_time) {
        // --- 2. 実績がなく、予定（シフト）のみがある場合（未来の見込み等） ---
        const start = new Date(`1970-01-01T${start_time}Z`);
        const end = new Date(`1970-01-01T${end_time}Z`);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            let duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            if (duration < 0) duration += 24;
            // 見込み休憩時間：4時間以上なら1時間休憩とする
            const assumedBreak = duration >= 4.0 ? 1.0 : 0.0;
            workHours = Math.max(0, duration - assumedBreak);
        }
      }

      if (workHours > 0) {
        const income = workHours * hourly_wage;
        if (!incomeByEmployee[employee_id]) {
          incomeByEmployee[employee_id] = 0;
        }
        incomeByEmployee[employee_id] += income;
      }
    }

    const formattedResult = Object.entries(incomeByEmployee).map(([employee_id, total_income]) => ({
      employee_id: parseInt(employee_id, 10),
      total_income,
    }));

    return NextResponse.json(formattedResult);

  } catch (error) {
    console.error('Failed to fetch annual summary:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch annual summary', details: errorMessage }, { status: 500 });
  }
}