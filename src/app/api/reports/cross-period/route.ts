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
    const employeesResult = await query('SELECT id, name, hourly_wage, initial_income, initial_income_year FROM employees ORDER BY id');
    const employees = employeesResult.rows;

    const monthIntervals = eachMonthOfInterval({
        start: new Date(`${startMonthStr}-01`),
        end: new Date(`${endMonthStr}-01`),
    });

    const results: Record<string, Record<number, Record<string, number>>> = {
        hours: {},
        days: {},
        pay: {},
    };
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

        const monthlyTotals: Record<number, { hours: number; days: number; pay: number; }> = {};

        for (const shift of shifts) {
            const employee = employees.find(e => e.id === shift.employee_id);
            if (!employee) continue;

            if (!monthlyTotals[shift.employee_id]) {
                monthlyTotals[shift.employee_id] = { hours: 0, days: 0, pay: 0 };
            }
            
            const startTime = useSchedule ? shift.actual_start_time || shift.schedule_start_time : shift.actual_start_time;
            const endTime = useSchedule ? shift.actual_end_time || shift.schedule_end_time : shift.actual_end_time;

            if (!startTime || !endTime) continue;

            const duration = calculateDuration(startTime, endTime);
            const breakHours = shift.break_hours ?? (duration >= 6 ? 1 : 0);
            const netHours = duration - breakHours;

            if (netHours > 0) {
                monthlyTotals[shift.employee_id].hours += netHours;
                monthlyTotals[shift.employee_id].days += 1;
                monthlyTotals[shift.employee_id].pay += netHours * employee.hourly_wage;
            }
        }

        for (const emp of employees) {
            if (!results.hours[emp.id]) {
                results.hours[emp.id] = {};
                results.days[emp.id] = {};
                results.pay[emp.id] = {};
            }
            results.hours[emp.id][monthLabel] = monthlyTotals[emp.id]?.hours || 0;
            results.days[emp.id][monthLabel] = monthlyTotals[emp.id]?.days || 0;
            results.pay[emp.id][monthLabel] = monthlyTotals[emp.id]?.pay || 0;
        }
    }
    
    // Add initial_income to the first month's pay for relevant employees
    const startYear = parseInt(startMonthStr.substring(0, 4), 10);
    const firstMonthLabel = monthLabels[0];
    if (firstMonthLabel) {
        for (const emp of employees) {
            if (emp.initial_income && emp.initial_income_year === startYear) {
                if (results.pay[emp.id]) {
                    results.pay[emp.id][firstMonthLabel] += emp.initial_income;
                }
            }
        }
    }

    return NextResponse.json({ employees, months: monthLabels, results });

  } catch (error) {
    console.error('Failed to generate cross-period report:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to generate report', details: errorMessage }, { status: 500 });
  }
}
