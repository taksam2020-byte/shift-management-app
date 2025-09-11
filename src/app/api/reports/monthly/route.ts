import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';

// Helper to parse time and calculate duration
const calculateDuration = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    if (isNaN(startHour) || isNaN(endHour) || isNaN(startMinute) || isNaN(endMinute)) return 0;
    const duration = (endHour + endMinute / 60) - (startHour + startMinute / 60);
    return duration > 0 ? duration : 0;
};

// GET handler for the monthly report
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
  }

  try {
    const sql = `
      SELECT
        e.id as employee_id,
        e.name as employee_name,
        e.hourly_wage,
        a.actual_start_time,
        a.actual_end_time,
        a.break_hours
      FROM employees e
      JOIN shifts s ON e.id = s.employee_id
      INNER JOIN actual_work_hours a ON s.id = a.shift_id
      WHERE s.date BETWEEN $1 AND $2
      ORDER BY e.id, s.date
    `;
    const { rows: shifts } = await query(sql, [startDate, endDate]);

    const report: Record<number, {
        employee_name: string;
        total_hours: number;
        total_days: number;
        total_pay: number;
    }> = {};

    for (const shift of shifts) {
        const employeeId = shift.employee_id;
        if (!report[employeeId]) {
            report[employeeId] = {
                employee_name: shift.employee_name,
                total_hours: 0,
                total_days: 0,
                total_pay: 0,
            };
        }

        const duration = calculateDuration(shift.actual_start_time, shift.actual_end_time);
        const breakHours = shift.break_hours ?? 1;
        
        const netHours = duration >= 6 ? duration - breakHours : duration;

        if (netHours > 0) {
            report[employeeId].total_hours += netHours;
            report[employeeId].total_days += 1;
            report[employeeId].total_pay += netHours * shift.hourly_wage;
        }
    }

    const reportArray = Object.values(report);
    return NextResponse.json(reportArray);

  } catch (error) {
    console.error('Failed to generate report:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to generate report', details: errorMessage }, { status: 500 });
  }
}
