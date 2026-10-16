// 勤務時間・休憩・給与の計算ルールをこのファイルに集約する。
// どの画面・APIでも同じ結果になるよう、時間計算は必ずここの関数を使うこと。

/** 休憩を自動で差し引く基準（この時間以上の勤務で DEFAULT_BREAK_HOURS を控除） */
export const BREAK_THRESHOLD_HOURS = 6;
/** 自動で差し引く休憩時間 */
export const DEFAULT_BREAK_HOURS = 1;
/** 基本勤務時間が未設定の従業員に使う時間帯 */
export const FALLBACK_WORK_HOURS = '09:00-17:00';

const toHours = (time: string | null | undefined): number | null => {
  if (!time) return null;
  const [h, m = '0'] = time.trim().split(':');
  const hour = Number(h);
  const minute = Number(m);
  if (h === '' || isNaN(hour) || isNaN(minute)) return null;
  return hour + minute / 60;
};

/**
 * 開始〜終了の拘束時間（休憩を引く前）を時間単位で返す。
 * 終了が開始より前なら日をまたいだ勤務（例 22:00-02:00 = 4h）として扱う。
 */
export function calcDuration(start: string | null | undefined, end: string | null | undefined): number {
  const s = toHours(start);
  const e = toHours(end);
  if (s === null || e === null) return 0;
  let duration = e - s;
  if (duration < 0) duration += 24;
  return duration;
}

/** 休憩が記録されていない場合に差し引く休憩時間 */
export function defaultBreakHours(duration: number): number {
  return duration >= BREAK_THRESHOLD_HOURS ? DEFAULT_BREAK_HOURS : 0;
}

/** DBの NUMERIC（文字列で返る）なども含めて休憩時間を数値にする。不正値は null */
export function parseBreakHours(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return isNaN(n) || n < 0 ? null : n;
}

/**
 * 実働時間（休憩控除後）。breakHours を省略・null にすると自動ルールで控除する。
 */
export function netHours(start: string | null | undefined, end: string | null | undefined, breakHours?: unknown): number {
  const duration = calcDuration(start, end);
  if (duration <= 0) return 0;
  const recorded = parseBreakHours(breakHours);
  const brk = recorded ?? defaultBreakHours(duration);
  return Math.max(0, duration - brk);
}

/** "HH:MM-HH:MM" 形式のシフト文字列の実働時間 */
export function shiftStringHours(shift: string | null | undefined): number {
  if (!shift || !shift.includes('-')) return 0;
  const [start, end] = shift.split('-');
  return netHours(start, end);
}

export interface WorkRecord {
  start_time: string | null;
  end_time: string | null;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
  break_hours?: unknown;
  /** 実績保存時の時給（なければ null） */
  actual_hourly_wage?: number | null;
}

/**
 * 1日分の勤務時間を求める。実績があれば実績、なければ useSchedule のときだけ予定で計算する。
 */
export function recordHours(record: WorkRecord, useSchedule: boolean): number {
  if (record.actual_start_time && record.actual_end_time) {
    return netHours(record.actual_start_time, record.actual_end_time, record.break_hours);
  }
  if (useSchedule && record.start_time && record.end_time) {
    return netHours(record.start_time, record.end_time);
  }
  return 0;
}

/** 時給: 実績保存時の時給があればそれを使い、なければ現在の時給を使う */
export function effectiveWage(record: WorkRecord, currentWage: number): number {
  const recorded = record.actual_hourly_wage;
  return typeof recorded === 'number' && recorded > 0 ? recorded : currentWage;
}

/** "YYYY-MM-DD" を返す（ローカル日付） */
export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 日本時間での今日の日付 "YYYY-MM-DD"（サーバーが海外時間でもずれないように） */
export function todayInJapan(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export interface IncomeRow extends WorkRecord {
  employee_id: number;
  hourly_wage: number; // 従業員マスタの現在の時給
}

/**
 * 従業員ごとの収入合計を求める。実績があれば実績、なければ予定（見込み）で計算する。
 */
export function sumIncomeByEmployee(rows: IncomeRow[]): Record<number, number> {
  const totals: Record<number, number> = {};
  for (const row of rows) {
    const hours = recordHours(row, true);
    if (hours <= 0) continue;
    totals[row.employee_id] = (totals[row.employee_id] || 0) + hours * effectiveWage(row, row.hourly_wage);
  }
  return totals;
}
