import { describe, expect, it } from 'vitest';
import {
  calcDuration, defaultBreakHours, effectiveWage, netHours, recordHours,
  shiftStringHours, sumIncomeByEmployee, todayInJapan,
} from '@/lib/worktime';

describe('calcDuration（拘束時間）', () => {
  it('通常の勤務', () => {
    expect(calcDuration('09:00', '17:30')).toBe(8.5);
  });
  it('DBの秒付き形式も読める', () => {
    expect(calcDuration('09:00:00', '13:15:00')).toBe(4.25);
  });
  it('日をまたぐ勤務は24時間を足して計算する', () => {
    expect(calcDuration('22:00', '02:00')).toBe(4);
  });
  it('未入力や不正な値は0', () => {
    expect(calcDuration('', '17:00')).toBe(0);
    expect(calcDuration(null, undefined)).toBe(0);
    expect(calcDuration('abc', '17:00')).toBe(0);
  });
});

describe('休憩ルール（6時間以上で1時間）', () => {
  it('6時間未満は休憩なし', () => {
    expect(defaultBreakHours(5.75)).toBe(0);
  });
  it('ちょうど6時間から1時間控除', () => {
    expect(defaultBreakHours(6)).toBe(1);
    expect(netHours('09:00', '15:00')).toBe(5);
  });
  it('記録された休憩があればそれを使う（0時間も有効）', () => {
    expect(netHours('09:00', '17:00', 0)).toBe(8);
    expect(netHours('09:00', '17:00', '0.50')).toBe(7.5); // DBのNUMERICは文字列で届く
  });
  it('予定の文字列から実働時間を計算する', () => {
    expect(shiftStringHours('10:00-17:00')).toBe(6);
    expect(shiftStringHours('10:00-14:00')).toBe(4);
    expect(shiftStringHours('')).toBe(0);
  });
});

describe('recordHours / effectiveWage', () => {
  const base = { start_time: '09:00', end_time: '17:00' };
  it('実績があれば実績を使う', () => {
    expect(recordHours({ ...base, actual_start_time: '09:00', actual_end_time: '12:00', break_hours: '0' }, false)).toBe(3);
  });
  it('実績が無い日は useSchedule のときだけ予定で計算する', () => {
    expect(recordHours(base, false)).toBe(0);
    expect(recordHours(base, true)).toBe(7);
  });
  it('実績保存時の時給があればそれを優先する', () => {
    expect(effectiveWage({ ...base, actual_hourly_wage: 1100 }, 1200)).toBe(1100);
    expect(effectiveWage({ ...base, actual_hourly_wage: null }, 1200)).toBe(1200);
  });
  it('従業員ごとの収入合計', () => {
    const totals = sumIncomeByEmployee([
      { employee_id: 1, hourly_wage: 1000, ...base }, // 予定 7h × 1000
      { employee_id: 1, hourly_wage: 1000, ...base, actual_start_time: '09:00', actual_end_time: '13:00', break_hours: 0, actual_hourly_wage: 900 }, // 4h × 900
      { employee_id: 2, hourly_wage: 1500, start_time: null, end_time: null },
    ]);
    expect(totals).toEqual({ 1: 7000 + 3600 });
  });
});

describe('todayInJapan', () => {
  it('UTCの夜は日本時間では翌日になる', () => {
    expect(todayInJapan(new Date('2026-10-15T16:00:00Z'))).toBe('2026-10-16');
    expect(todayInJapan(new Date('2026-10-15T14:00:00Z'))).toBe('2026-10-15');
  });
});
