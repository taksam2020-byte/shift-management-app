// シフト自動作成（仮シフト割当）のロジック。DBに依存しない純粋な関数にしてテストできるようにしている。
import { FALLBACK_WORK_HOURS, shiftStringHours } from '@/lib/worktime';

export interface SchedulerEmployee {
  id: number;
  name: string;
  group_name: string | null;
  default_work_hours: string | null;
  max_weekly_hours: number | null;
  max_weekly_days: number | null;
  hourly_wage: number;
  annual_income_limit: number | null;
  initial_income: number | null;
  initial_income_year: number | null;
}

export interface SchedulerRequest {
  employee_id: number;
  date: string; // YYYY-MM-DD
  request_type: 'holiday' | 'work';
}

/** 日付 → 従業員ID → "HH:MM-HH:MM" または "休み" */
export type Schedule = Record<string, Record<number, string>>;

export const OFF = '休み';

export interface SchedulerInput {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  employees: SchedulerEmployee[];
  /** 期間を含む週（月曜〜日曜）の範囲に入っている既存シフト。週の上限計算に使う */
  existingShifts: Schedule;
  requests: SchedulerRequest[];
  /** 土日・祝日・会社休業日など、全員休みにする日 */
  nonWorkDays: Set<string>;
  /** 1月1日〜期間開始の前日までの収入（実績または予定）。年収上限の判定に使う */
  pastIncome: Record<number, number>;
  /** true: 期間内に既に入っているシフトを残し、空いている所だけ埋める */
  keepExisting: boolean;
}

// --- 日付ヘルパー（タイムゾーンの影響を受けないよう UTC で計算する） ---
const parse = (d: string) => new Date(`${d}T00:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);
export const addDaysStr = (d: string, n: number) => {
  const x = parse(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fmt(x);
};
/** 0=日曜 ... 6=土曜 */
export const dayOfWeek = (d: string) => parse(d).getUTCDay();
/** その日を含む週の月曜日 */
export const weekStart = (d: string) => addDaysStr(d, -((dayOfWeek(d) + 6) % 7));

export function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  for (let d = start; d <= end; d = addDaysStr(d, 1)) days.push(d);
  return days;
}

const isWork = (shift: string | undefined): shift is string => !!shift && shift !== OFF;
const shiftOf = (emp: SchedulerEmployee) => emp.default_work_hours || FALLBACK_WORK_HOURS;

export function generateSchedule(input: SchedulerInput): Schedule {
  const { startDate, endDate, employees, existingShifts, requests, nonWorkDays, pastIncome, keepExisting } = input;
  const allDays = eachDay(startDate, endDate);
  const targetYear = Number(startDate.slice(0, 4));

  // 既存シフトを土台にする（期間外の週の分は上限計算のため常に残す）
  const schedule: Schedule = {};
  for (const [date, shifts] of Object.entries(existingShifts)) {
    schedule[date] = { ...shifts };
  }
  for (const date of allDays) {
    if (!keepExisting) {
      schedule[date] = {};
    } else {
      // 残すのは「出勤」の予定だけ。休み扱いの空データは作り直す
      const kept: Record<number, string> = {};
      for (const [id, v] of Object.entries(schedule[date] || {})) {
        if (isWork(v)) kept[Number(id)] = v;
      }
      schedule[date] = kept;
    }
  }

  const holidayRequests = new Map<number, Set<string>>();
  const workRequests = new Map<number, Set<string>>();
  for (const r of requests) {
    const map = r.request_type === 'holiday' ? holidayRequests : workRequests;
    if (!map.has(r.employee_id)) map.set(r.employee_id, new Set());
    map.get(r.employee_id)!.add(r.date);
  }

  const hoursInDays = (emp: SchedulerEmployee, days: string[]) =>
    days.reduce((acc, d) => acc + (isWork(schedule[d]?.[emp.id]) ? shiftStringHours(schedule[d][emp.id]) : 0), 0);

  const canWork = (emp: SchedulerEmployee, date: string): boolean => {
    if (schedule[date]?.[emp.id]) return false; // すでに出勤または休みが決まっている

    const week = eachDay(weekStart(date), addDaysStr(weekStart(date), 6));
    const daysInWeek = week.filter(d => isWork(schedule[d]?.[emp.id])).length;
    const hoursInWeek = hoursInDays(emp, week);
    const prospective = shiftStringHours(shiftOf(emp));

    if (emp.max_weekly_days && daysInWeek >= emp.max_weekly_days) return false;
    if (emp.max_weekly_hours && hoursInWeek + prospective > emp.max_weekly_hours) return false;

    if (emp.annual_income_limit && emp.hourly_wage) {
      // 年収 = 今年の初期収入 + 1月〜先月までの収入 + 今回の期間の予定 + この日の分
      const initial = emp.initial_income && emp.initial_income_year === targetYear ? emp.initial_income : 0;
      const total = initial + (pastIncome[emp.id] || 0) + hoursInDays(emp, allDays) * emp.hourly_wage;
      if (total + prospective * emp.hourly_wage > emp.annual_income_limit) return false;
    }
    return true;
  };

  const assign = (emp: SchedulerEmployee, date: string) => { schedule[date][emp.id] = shiftOf(emp); };

  // --- 休業日と希望休（ただし既に残した出勤予定は上書きしない） ---
  for (const date of allDays) {
    for (const emp of employees) {
      if (schedule[date][emp.id]) continue;
      if (nonWorkDays.has(date) || holidayRequests.get(emp.id)?.has(date)) {
        schedule[date][emp.id] = OFF;
      }
    }
  }

  const workDays = allDays.filter(d => !nonWorkDays.has(d));
  const isPostHoliday = (d: string) => dayOfWeek(d) === 1 || nonWorkDays.has(addDaysStr(d, -1));

  // 希望出勤日を最優先で割り当て
  for (const date of workDays) {
    for (const emp of employees) {
      if (workRequests.get(emp.id)?.has(date) && canWork(emp, date)) assign(emp, date);
    }
  }

  // 月曜・休み明けは出られる人を全員割り当て
  for (const date of workDays) {
    if (!isPostHoliday(date)) continue;
    for (const emp of employees) {
      if (canWork(emp, date)) assign(emp, date);
    }
  }

  // 残りの枠を、勤務時間の少ない人から順に公平に割り当て
  for (let pass = 1; ; pass++) {
    let assignments = 0;
    for (const date of workDays) {
      const target = isPostHoliday(date) ? pass + 1 : pass;
      const assigned = Object.values(schedule[date]).filter(isWork).length;
      if (assigned >= target) continue;

      const totalHours = employees.reduce((acc, e) => acc + hoursInDays(e, allDays), 0);
      const avgHours = employees.length > 0 ? totalHours / employees.length : 0;
      const groupsInDay = new Set(
        Object.entries(schedule[date])
          .filter(([, v]) => isWork(v))
          .map(([id]) => employees.find(e => e.id === Number(id))?.group_name)
          .filter(Boolean)
      );

      let best: SchedulerEmployee | null = null;
      let bestScore = -Infinity;
      for (const emp of employees) {
        if (!canWork(emp, date)) continue;
        let score = 100 + (avgHours > 0 ? avgHours - hoursInDays(emp, allDays) : 0);
        if (emp.group_name && !groupsInDay.has(emp.group_name)) score += 40; // 別グループを優先
        if (score > bestScore) {
          bestScore = score;
          best = emp;
        }
      }
      if (best) {
        assign(best, date);
        assignments++;
      }
    }
    if (assignments === 0) break;
  }

  // 期間内の結果だけを返す（未割り当ては休み）
  const result: Schedule = {};
  for (const date of allDays) {
    result[date] = {};
    for (const emp of employees) {
      result[date][emp.id] = schedule[date][emp.id] || OFF;
    }
  }
  return result;
}
