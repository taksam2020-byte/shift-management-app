import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';
import { eachMonthOfInterval, format } from 'date-fns';

// Helper to parse time and calculate duration
const calculateDuration = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    if (isNaN(startHour) || isNaN(endHour) || isNaN(startMinute) || isNaN(endMinute)) return 0;
    const duration = (endHour + endMinute / 60) - (startHour + startMinute / 60);
    return duration > 0 ? duration : 0;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startMonthStr = searchParams.get('startMonth'); // YYYY-MM
  const endMonthStr = searchParams.get('endMonth');   // YYYY-MM
  const closingDay = parseInt(searchParams.get('closingDay') || '10', 10);
  const useSchedule = searchParams.get('useSchedule') === 'true';

  if (!startMonthStr || !endMonthStr) {
    return NextResponse.json({ error: 'Start and end month are required' }, { status: 400 });
  }

  try {
    const employeesResult = await query('SELECT id, name FROM employees ORDER BY id');
    const employees = employeesResult.rows;

    const monthIntervals = eachMonthOfInterval({
        start: new Date(`${startMonthStr}-01`),
        end: new Date(`${endMonthStr}-01`),
    });

    const results: Record<number, Record<string, number>> = {};
    const monthLabels: string[] = [];

    for (const monthDate of monthIntervals) {
        const monthLabel = format(monthDate, 'yyyy-MM');
        monthLabels.push(monthLabel);

        const periodEnd = new Date(monthDate.getFullYear(), monthDate.getMonth(), closingDay);
        const periodStart = new Date(periodEnd);
        periodStart.setMonth(periodStart.getMonth() - 1);
        periodStart.setDate(periodStart.getDate() + 1);

        const startDate = format(periodStart, 'yyyy-MM-dd');
        const endDate = format(periodEnd, 'yyyy-MM-dd');

        const joinType = useSchedule ? 'LEFT' : 'INNER';
        const sql = `
            SELECT
                s.employee_id,
                s.start_time as schedule_start_time,
                s.end_time as schedule_end_time,
                a.actual_start_time,
                a.actual_end_time,
                a.break_hours
            FROM shifts s
            ${joinType} JOIN actual_work_hours a ON s.id = a.shift_id
            WHERE s.date BETWEEN $1 AND $2
        `;
        const { rows: shifts } = await query(sql, [startDate, endDate]);

        const monthlyTotals: Record<number, number> = {};

        for (const shift of shifts) {
            if (!monthlyTotals[shift.employee_id]) {
                monthlyTotals[shift.employee_id] = 0;
            }
            
            const startTime = useSchedule ? shift.actual_start_time || shift.schedule_start_time : shift.actual_start_time;
            const endTime = useSchedule ? shift.actual_end_time || shift.schedule_end_time : shift.actual_end_time;

            if (!startTime || !endTime) continue;

            const duration = calculateDuration(startTime, endTime);
            const breakHours = shift.break_hours ?? (duration >= 6 ? 1 : 0);
            const netHours = duration - breakHours;

            if (netHours > 0) {
                monthlyTotals[shift.employee_id] += netHours;
            }
        }

        for (const emp of employees) {
            if (!results[emp.id]) {
                results[emp.id] = {};
            }
            results[emp.id][monthLabel] = monthlyTotals[emp.id] || 0;
        }
    }

    return NextResponse.json({ employees, months: monthLabels, results });

  } catch (error) {
    console.error('Failed to generate cross-period report:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to generate report', details: errorMessage }, { status: 500 });
  }
}