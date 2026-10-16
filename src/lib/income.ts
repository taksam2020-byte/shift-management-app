import { query } from '@/lib/db.mjs';
import { IncomeRow, sumIncomeByEmployee } from '@/lib/worktime';

/**
 * 期間中（両端を含む）の従業員ごとの収入合計をDBから計算する。
 * 実績があれば実績（保存時の時給）、なければ予定（現在の時給）で見込み計算する。
 */
export async function fetchIncomeByEmployee(startDate: string, endDate: string): Promise<Record<number, number>> {
  const { rows } = await query(
    `SELECT
       s.employee_id,
       s.start_time,
       s.end_time,
       a.actual_start_time,
       a.actual_end_time,
       a.break_hours,
       a.hourly_wage AS actual_hourly_wage,
       e.hourly_wage
     FROM shifts s
     JOIN employees e ON s.employee_id = e.id
     LEFT JOIN actual_work_hours a ON s.id = a.shift_id
     WHERE s.date >= $1 AND s.date <= $2`,
    [startDate, endDate]
  );
  return sumIncomeByEmployee(rows as IncomeRow[]);
}
