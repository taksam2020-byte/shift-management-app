import { describe, expect, it } from 'vitest';
import { generateSchedule, OFF, SchedulerEmployee, SchedulerInput, weekStart } from '@/lib/scheduler';

const emp = (id: number, extra: Partial<SchedulerEmployee> = {}): SchedulerEmployee => ({
  id, name: `E${id}`, group_name: null, default_work_hours: '10:00-17:00',
  max_weekly_hours: null, max_weekly_days: null, hourly_wage: 1000,
  annual_income_limit: null, initial_income: null, initial_income_year: null, ...extra,
});

// 2026-10-05(月) 〜 2026-10-09(金) の1週間、土日なし
const baseInput = (over: Partial<SchedulerInput> = {}): SchedulerInput => ({
  startDate: '2026-10-05',
  endDate: '2026-10-11',
  employees: [emp(1), emp(2)],
  existingShifts: {},
  requests: [],
  nonWorkDays: new Set(['2026-10-10', '2026-10-11']),
  pastIncome: {},
  keepExisting: true,
  ...over,
});

describe('generateSchedule（仮シフト自動作成）', () => {
  it('weekStart は月曜日を返す', () => {
    expect(weekStart('2026-10-08')).toBe('2026-10-05');
    expect(weekStart('2026-10-11')).toBe('2026-10-05');
  });

  it('休業日は全員休み、希望休は休みになる', () => {
    const result = generateSchedule(baseInput({
      requests: [{ employee_id: 1, date: '2026-10-07', request_type: 'holiday' }],
    }));
    expect(result['2026-10-10'][1]).toBe(OFF);
    expect(result['2026-10-10'][2]).toBe(OFF);
    expect(result['2026-10-07'][1]).toBe(OFF);
  });

  it('月曜（休み明け）は出られる人を全員割り当てる', () => {
    const result = generateSchedule(baseInput());
    expect(result['2026-10-05'][1]).toBe('10:00-17:00');
    expect(result['2026-10-05'][2]).toBe('10:00-17:00');
  });

  it('週の上限日数を超えない', () => {
    const result = generateSchedule(baseInput({ employees: [emp(1, { max_weekly_days: 2 }), emp(2)] }));
    const days = Object.values(result).filter(d => d[1] !== OFF).length;
    expect(days).toBeLessThanOrEqual(2);
  });

  it('既存シフトを残す設定では、入っている予定を上書きしない', () => {
    const result = generateSchedule(baseInput({
      existingShifts: { '2026-10-06': { 1: '13:00-15:00' } },
    }));
    expect(result['2026-10-06'][1]).toBe('13:00-15:00');
  });

  it('作り直す設定では、既存シフトを無視する', () => {
    const result = generateSchedule(baseInput({
      keepExisting: false,
      existingShifts: { '2026-10-06': { 1: '13:00-15:00' } },
    }));
    expect(result['2026-10-06'][1]).not.toBe('13:00-15:00');
  });

  it('結果に含まれるのは渡した（在籍中の）従業員と期間内の日付だけ', () => {
    const result = generateSchedule(baseInput({
      existingShifts: { '2026-10-06': { 99: '10:00-17:00' }, '2026-09-30': { 1: '10:00-17:00' } },
    }));
    expect(Object.keys(result)).not.toContain('2026-09-30');
    expect(Object.keys(result['2026-10-06']).map(Number).sort()).toEqual([1, 2]);
  });

  it('年収上限は今年の過去の収入も含めて判定する', () => {
    // 1日 6h × 1000円 = 6000円。上限 100万円、過去に 99万円 → あと1日だけ入れる
    const result = generateSchedule(baseInput({
      employees: [emp(1, { annual_income_limit: 1_000_000 })],
      pastIncome: { 1: 990_000 },
    }));
    const days = Object.values(result).filter(d => d[1] !== OFF).length;
    expect(days).toBe(1);
  });

  it('初期収入は対象年が一致するときだけ数える', () => {
    const limited = (year: number) => generateSchedule(baseInput({
      employees: [emp(1, { annual_income_limit: 1_000_000, initial_income: 995_000, initial_income_year: year })],
    }));
    expect(Object.values(limited(2026)).filter(d => d[1] !== OFF).length).toBe(0);
    expect(Object.values(limited(2025)).filter(d => d[1] !== OFF).length).toBeGreaterThan(0);
  });
});
