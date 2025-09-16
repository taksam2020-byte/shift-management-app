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
  const useSchedule = searchParams.get('useSchedule') === 'true';

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
  }

  try {
    let sql;
    if (useSchedule) {
      // 実績＋予定で計算
      sql = `
        SELECT
          e.id as employee_id,
          e.name as employee_name,
          e.hourly_wage,
          s.start_time as schedule_start_time,
          s.end_time as schedule_end_time,
          a.actual_start_time,
          a.actual_end_time,
          a.break_hours
        FROM employees e
        JOIN shifts s ON e.id = s.employee_id
        LEFT JOIN actual_work_hours a ON s.id = a.shift_id
        WHERE s.date BETWEEN $1 AND $2
        ORDER BY e.id, s.date
      `;
    } else {
      // 実績のみで計算
      sql = `
        SELECT
          e.id as employee_id,
          e.name as employee_name,
          e.hourly_wage,
          s.start_time as schedule_start_time, -- Not used but kept for consistency
          s.end_time as schedule_end_time,   -- Not used but kept for consistency
          a.actual_start_time,
          a.actual_end_time,
          a.break_hours
        FROM employees e
        JOIN shifts s ON e.id = s.employee_id
        INNER JOIN actual_work_hours a ON s.id = a.shift_id
        WHERE s.date BETWEEN $1 AND $2
        ORDER BY e.id, s.date
      `;
    }

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

        // Use actual times if available, otherwise fall back to scheduled times
        const startTime = shift.actual_start_time || shift.schedule_start_time;
        const endTime = shift.actual_end_time || shift.schedule_end_time;

        if (!startTime || !endTime) continue; // Skip if no time data is available at all

        const duration = calculateDuration(startTime, endTime);
        
        // Use recorded break_hours for actuals, default to 1 hour for schedule
        const breakHours = shift.break_hours ?? (duration >= 6 ? 1 : 0);
        
        const netHours = duration - breakHours;

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
