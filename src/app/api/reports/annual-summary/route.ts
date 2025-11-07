import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';

// GET handler to fetch annual summary for all employees for a given year
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year'); // e.g., 2024

  if (!year) {
    return NextResponse.json({ error: 'year is required' }, { status: 400 });
  }

  try {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // Sum of earnings from actual_work_hours for the entire year, grouped by employee
    const actualsSql = `
      SELECT 
        s.employee_id,
        SUM(a.hourly_wage * (
          EXTRACT(EPOCH FROM (a.actual_end_time - a.actual_start_time)) / 3600 - COALESCE(a.break_hours, 0)
        )) as total_income
      FROM actual_work_hours a
      JOIN shifts s ON a.shift_id = s.id
      WHERE s.date >= $1
        AND s.date <= $2
        AND a.hourly_wage IS NOT NULL
        AND a.actual_start_time IS NOT NULL
        AND a.actual_end_time IS NOT NULL
      GROUP BY s.employee_id
    `;
    const actualsResult = await query(actualsSql, [startDate, endDate]);

    // We are not considering initial_income for now to simplify the logic
    // as it might apply to a different year.

    return NextResponse.json(actualsResult.rows);

  } catch (error) {
    console.error('Failed to fetch annual summary:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch annual summary', details: errorMessage }, { status: 500 });
  }
}
