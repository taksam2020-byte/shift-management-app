import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';

// GET handler to fetch annual summary for an employee
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');
  const year = searchParams.get('year'); // e.g., 2024
  const untilMonth = searchParams.get('untilMonth'); // e.g., 3 (calculates up to end of Feb)

  if (!employeeId || !year || !untilMonth) {
    return NextResponse.json({ error: 'employeeId, year, and untilMonth are required' }, { status: 400 });
  }

  try {
    // 1. Get initial income for the specified year
    const employeeResult = await query(
      'SELECT initial_income, initial_income_year FROM employees WHERE id = $1',
      [employeeId]
    );
    const employee = employeeResult.rows[0];
    let totalIncome = 0;
    if (employee && employee.initial_income_year === parseInt(year, 10)) {
      totalIncome += employee.initial_income || 0;
    }

    // 2. Get sum of earnings from actual_work_hours up to the specified month
    const startDate = `${year}-01-01`;
    // Calculate the last day of the month BEFORE untilMonth
    const endDate = new Date(parseInt(year, 10), parseInt(untilMonth, 10) - 1, 0);
    const endDateStr = endDate.toISOString().substring(0, 10);

    const actualsSql = `
      SELECT 
        a.actual_start_time, 
        a.actual_end_time, 
        a.break_hours, 
        a.hourly_wage
      FROM actual_work_hours a
      JOIN shifts s ON a.shift_id = s.id
      WHERE s.employee_id = $1
        AND s.date >= $2
        AND s.date <= $3
        AND a.hourly_wage IS NOT NULL
    `;
    const actualsResult = await query(actualsSql, [employeeId, startDate, endDateStr]);

    let earnedFromWork = 0;
    for (const row of actualsResult.rows) {
        if (!row.actual_start_time || !row.actual_end_time) continue;

        const start = new Date(`1970-01-01T${row.actual_start_time}Z`);
        const end = new Date(`1970-01-01T${row.actual_end_time}Z`);
        let durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        if (durationHours < 0) durationHours += 24; // Handle overnight shifts

        const breakHours = row.break_hours || 0;
        const workHours = durationHours - breakHours;

        if (workHours > 0) {
            earnedFromWork += workHours * row.hourly_wage;
        }
    }

    totalIncome += earnedFromWork;

    return NextResponse.json({ totalIncome });

  } catch (error) {
    console.error('Failed to fetch annual summary:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch annual summary', details: errorMessage }, { status: 500 });
  }
}
