import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';
import { differenceInMinutes, parseISO } from 'date-fns';

// GET handler to fetch annual summary for all employees for a given year
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
  }

  try {
    // 1. Fetch all relevant actual work hours records within the fiscal year
    const actualsSql = `
      SELECT 
        s.employee_id,
        a.actual_start_time,
        a.actual_end_time,
        a.break_hours,
        a.hourly_wage
      FROM actual_work_hours a
      JOIN shifts s ON a.shift_id = s.id
      WHERE s.date >= $1
        AND s.date <= $2
        AND a.hourly_wage IS NOT NULL
        AND a.actual_start_time IS NOT NULL
        AND a.actual_end_time IS NOT NULL
    `;
    const actualsResult = await query(actualsSql, [startDate, endDate]);

    // 2. Calculate total income for each employee in TypeScript
    const incomeByEmployee: { [key: number]: number } = {};

    for (const record of actualsResult.rows) {
      const { employee_id, actual_start_time, actual_end_time, break_hours, hourly_wage } = record;

      if (!actual_start_time || !actual_end_time) continue;

      // Use date-fns to reliably calculate the duration
      const start = parseISO(actual_start_time);
      const end = parseISO(actual_end_time);
      const durationInMinutes = differenceInMinutes(end, start);
      const durationInHours = durationInMinutes / 60;
      
      const workHours = durationInHours - (break_hours || 0);

      if (workHours > 0) {
        const income = workHours * hourly_wage;
        if (!incomeByEmployee[employee_id]) {
          incomeByEmployee[employee_id] = 0;
        }
        incomeByEmployee[employee_id] += income;
      }
    }

    // 3. Format the result into the expected array structure
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