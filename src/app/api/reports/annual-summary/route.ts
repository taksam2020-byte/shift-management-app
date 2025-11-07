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

    return NextResponse.json(actualsResult.rows);

  } catch (error) {
    console.error('Failed to fetch annual summary:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch annual summary', details: errorMessage }, { status: 500 });
  }
}
