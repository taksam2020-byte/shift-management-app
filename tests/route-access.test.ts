import { describe, expect, it } from 'vitest';
import { canOpen, ClientUser } from '@/components/AuthProvider';

const admin: ClientUser = { id: 0, name: '管理者', isAdmin: true };
const viewer: ClientUser = { id: 0, name: '閲覧者', isAdmin: false, isViewer: true };
const employee: ClientUser = { id: 5, name: '佐藤', isAdmin: false };

describe('画面ごとの権限', () => {
  it('管理者画面は管理者だけ', () => {
    expect(canOpen(admin, '/admin/schedule')).toBe(true);
    expect(canOpen(employee, '/admin/schedule')).toBe(false);
    expect(canOpen(viewer, '/admin/employees')).toBe(false);
  });
  it('集計とマニュアルは閲覧者も開ける', () => {
    expect(canOpen(viewer, '/admin/reports/monthly')).toBe(true);
    expect(canOpen(viewer, '/admin/manual')).toBe(true);
    expect(canOpen(employee, '/admin/reports/monthly')).toBe(false);
  });
  it('従業員は自分のマイシフト・希望提出だけ開ける', () => {
    expect(canOpen(employee, '/my-schedule/5')).toBe(true);
    expect(canOpen(employee, '/my-schedule/6')).toBe(false);
    expect(canOpen(employee, '/requests/5')).toBe(true);
    expect(canOpen(employee, '/requests/6')).toBe(false);
    expect(canOpen(admin, '/my-schedule/6')).toBe(true);
  });
  it('全体シフトは誰でも開ける', () => {
    expect(canOpen(viewer, '/schedule/view')).toBe(true);
    expect(canOpen(employee, '/dashboard')).toBe(true);
  });
});
