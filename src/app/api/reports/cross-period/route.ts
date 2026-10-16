import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';
import { eachMonthOfInterval, format } from 'date-fns';
import { checkRole } from '@/lib/auth';
import { effectiveWage, recordHours, WorkRecord } from '@/lib/worktime';

interface Employee {
  id: number;
  name: string;
  hourly_wage: number;
  initial_income: number | null;
  initial_income_year: number | null;
}

/** 月度（YYYY-MM）と締め日から集計期間を求める。20日締めなら「前月21日〜当月20日」 */
function periodOf(monthDate: Date, closingDay: number) {
  if (closingDay === 31) {
    return {
      start: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1),
      end: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0),
    };
  }
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth(), closingDay);
  const start = new Date(end);
  start.setMonth(start.getMonth() - 1);
  start.setDate(start.getDate() + 1);
  return { start, end };
}

// 複数月度の勤務時間・日数・概算給与
// - 管理者: 全員分
// - 閲覧者: 全員分（給与は返さない）
// - 従業員: 自分の分だけ
export async function GET(request: Request) {
  const auth = await checkRole(request, 'admin', 'viewer', 'employee');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const startMonthStr = searchParams.get('startMonth'); // YYYY-MM
  const endMonthStr = searchParams.get('endMonth');   // YYYY-MM
  const closingDay = parseInt(searchParams.get('closingDay') || '31', 10);
  const useSchedule = searchParams.get('useSchedule') === 'true';
  const includeInactive = searchParams.get('includeInactive') === 'true';

  if (!startMonthStr || !endMonthStr) {
    return NextResponse.json({ error: 'Start and end month are required' }, { status: 400 });
  }

  try {
    let employees: Employee[];
    if (auth.role === 'employee') {
      const { rows } = await query('SELECT id, name, hourly_wage, initial_income, initial_income_year FROM employees WHERE id = $1', [auth.id]);
      employees = rows;
    } else {
      const condition = includeInactive ? '' : 'WHERE is_active = TRUE OR is_active IS NULL';
      const { rows } = await query(`SELECT id, name, hourly_wage, initial_income, initial_income_year FROM employees ${condition} ORDER BY id`);
      employees = rows;
    }
    const employeeMap = new Map(employees.map(e => [e.id, e]));

    const monthIntervals = eachMonthOfInterval({
        start: new Date(`${startMonthStr}-01T00:00:00`),
        end: new Date(`${endMonthStr}-01T00:00:00`),
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

        const { start, end } = periodOf(monthDate, closingDay);
        const joinType = useSchedule ? 'LEFT' : 'INNER';
        const { rows: shifts } = await query(`
            SELECT
                s.employee_id,
                s.start_time,
                s.end_time,
                a.actual_start_time,
                a.actual_end_time,
                a.break_hours,
                a.hourly_wage AS actual_hourly_wage
            FROM shifts s
            ${joinType} JOIN actual_work_hours a ON s.id = a.shift_id
            WHERE s.date BETWEEN $1 AND $2
        `, [format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')]);

        const monthlyTotals: Record<number, { hours: number; days: number; pay: number; }> = {};

        for (const shift of shifts as (WorkRecord & { employee_id: number })[]) {
            const employee = employeeMap.get(shift.employee_id);
            if (!employee) continue;

            const hours = recordHours(shift, useSchedule);
            if (hours <= 0) continue;

            const totals = monthlyTotals[shift.employee_id] ??= { hours: 0, days: 0, pay: 0 };
            totals.hours += hours;
            totals.days += 1;
            // 実績がある日は「実績保存時の時給」、予定のみの日は現在の時給
            totals.pay += hours * effectiveWage(shift, employee.hourly_wage);
        }

        for (const emp of employees) {
            results.hours[emp.id] ??= {};
            results.days[emp.id] ??= {};
            results.pay[emp.id] ??= {};
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
            if (emp.initial_income && emp.initial_income_year === startYear && results.pay[emp.id]) {
                results.pay[emp.id][firstMonthLabel] += emp.initial_income;
            }
        }
    }

    // 閲覧者には給与関連の情報を返さない
    if (auth.role === 'viewer') {
      results.pay = {};
    }
    const publicEmployees = employees.map(e => (
      auth.role === 'viewer' ? { id: e.id, name: e.name } : e
    ));

    return NextResponse.json({ employees: publicEmployees, months: monthLabels, results });

  } catch (error) {
    console.error('Failed to generate cross-period report:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to generate report', details: errorMessage }, { status: 500 });
  }
}
