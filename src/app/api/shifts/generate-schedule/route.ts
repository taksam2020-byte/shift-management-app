import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';
import holiday_jp from '@holiday-jp/holiday_jp';
import { checkRole } from '@/lib/auth';
import { fetchIncomeByEmployee } from '@/lib/income';
import { addDaysStr, dayOfWeek, eachDay, generateSchedule, Schedule, SchedulerEmployee, weekStart } from '@/lib/scheduler';

const toDateStr = (d: Date | string) => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));

/**
 * 仮シフトを自動作成して返す（DBには保存しない。保存は画面の「シフト保存」で行う）。
 * body: { startDate, endDate, keepExisting?: boolean, baseSchedule?: Schedule }
 *  - keepExisting（既定 true）: 既に入っているシフトを残して空き枠だけ埋める
 *  - baseSchedule: 画面で編集中（未保存）のシフト。指定するとDBの内容の代わりに土台にする
 */
export async function POST(request: Request) {
    const auth = await checkRole(request, 'admin');
    if (auth instanceof NextResponse) return auth;

    try {
        const { startDate, endDate, keepExisting = true, baseSchedule } = await request.json();
        if (!startDate || !endDate) {
            return NextResponse.json({ error: 'Start and end date are required' }, { status: 400 });
        }

        // 週の上限計算のため、期間を含む週（月〜日）全体の既存シフトを取得する
        const fetchStart = weekStart(startDate);
        const fetchEnd = addDaysStr(weekStart(endDate), 6);

        // 退職済みの従業員は自動作成の対象にしない
        const employeesResult = await query(
            `SELECT id, name, group_name, default_work_hours, max_weekly_hours, max_weekly_days, hourly_wage,
                    annual_income_limit, initial_income, initial_income_year
             FROM employees WHERE is_active = TRUE OR is_active IS NULL ORDER BY id`
        );
        const employees: SchedulerEmployee[] = employeesResult.rows;

        const [existingShiftsResult, requestsResult, companyHolidaysResult] = await Promise.all([
            query(`SELECT employee_id, to_char(date, 'YYYY-MM-DD') AS date, start_time, end_time FROM shifts WHERE date >= $1 AND date <= $2`, [fetchStart, fetchEnd]),
            query(`SELECT employee_id, to_char(date, 'YYYY-MM-DD') AS date, request_type FROM shift_requests WHERE date BETWEEN $1 AND $2`, [startDate, endDate]),
            query(`SELECT to_char(date, 'YYYY-MM-DD') AS date FROM company_holidays WHERE date BETWEEN $1 AND $2`, [startDate, endDate]),
        ]);

        const existingShifts: Schedule = {};
        for (const s of existingShiftsResult.rows) {
            const d = toDateStr(s.date);
            if (!existingShifts[d]) existingShifts[d] = {};
            existingShifts[d][s.employee_id] = s.start_time && s.end_time
                ? `${s.start_time.substring(0, 5)}-${s.end_time.substring(0, 5)}`
                : '休み';
        }

        // 画面で編集中の内容があれば、期間内はそちらを優先する
        if (keepExisting && baseSchedule && typeof baseSchedule === 'object') {
            for (const d of eachDay(startDate, endDate)) {
                existingShifts[d] = {};
                for (const [id, v] of Object.entries((baseSchedule as Schedule)[d] || {})) {
                    if (typeof v === 'string' && v.includes('-')) existingShifts[d][Number(id)] = v;
                }
            }
        }

        // 土日・祝日・会社休業日
        const nonWorkDays = new Set<string>();
        companyHolidaysResult.rows.forEach((h: { date: string }) => nonWorkDays.add(toDateStr(h.date)));
        holiday_jp.between(new Date(`${startDate}T00:00:00Z`), new Date(`${endDate}T00:00:00Z`))
            .forEach(h => nonWorkDays.add(toDateStr(h.date)));
        eachDay(startDate, endDate).forEach(d => {
            if (dayOfWeek(d) === 0 || dayOfWeek(d) === 6) nonWorkDays.add(d);
        });

        // 年収上限の判定用：その年の1月1日〜期間開始の前日までの収入
        const yearStart = `${startDate.slice(0, 4)}-01-01`;
        const pastIncome = startDate > yearStart
            ? await fetchIncomeByEmployee(yearStart, addDaysStr(startDate, -1))
            : {};

        const schedule = generateSchedule({
            startDate,
            endDate,
            employees,
            existingShifts,
            requests: requestsResult.rows.map((r: { employee_id: number; date: string; request_type: 'holiday' | 'work' }) => ({
                employee_id: r.employee_id,
                date: toDateStr(r.date),
                request_type: r.request_type,
            })),
            nonWorkDays,
            pastIncome,
            keepExisting: !!keepExisting,
        });

        return NextResponse.json(schedule);

    } catch (error) {
        console.error('[GENERATE_SCHEDULE] CRITICAL ERROR:', error);
        return NextResponse.json({ error: 'Failed to generate schedule' }, { status: 500 });
    }
}
