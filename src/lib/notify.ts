// 通知まわりの共通処理：通知用テーブルの用意、登録された端末への送信、締切リマインドの判定。
import { query } from '@/lib/db.mjs';
import { sendWebPush, type PushSubscriptionData, type VapidKeys } from '@/lib/webpush';

export interface NotificationPayload {
  title: string;
  body: string;
  /** 通知をタップしたときに開く画面 */
  url: string;
  /** 同じ tag の通知は端末上で1つにまとめられる */
  tag?: string;
}

let tablesReady: Promise<void> | null = null;

/**
 * 通知用のテーブルを用意する（何度呼んでも安全）。
 * ビルド時のマイグレーションが動かない環境でも使えるよう、初回利用時に確認する。
 */
export function ensureNotificationTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id SERIAL PRIMARY KEY,
          role TEXT NOT NULL,
          employee_id INTEGER,
          endpoint TEXT NOT NULL UNIQUE,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`);
      await query(`
        CREATE TABLE IF NOT EXISTS request_deadlines (
          id SERIAL PRIMARY KEY,
          period_start DATE NOT NULL,
          period_end DATE NOT NULL,
          deadline DATE NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`);
      await query(`
        CREATE TABLE IF NOT EXISTS notification_log (
          kind TEXT NOT NULL,
          key TEXT NOT NULL,
          sent_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (kind, key)
        )`);
    })().catch((error) => {
      tablesReady = null;
      throw error;
    });
  }
  return tablesReady;
}

export function getVapidKeys(): VapidKeys | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com' };
}

interface SubscriptionRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function sendToRows(rows: SubscriptionRow[], payload: NotificationPayload): Promise<{ sent: number; failed: number }> {
  const vapid = getVapidKeys();
  if (!vapid) {
    console.warn('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY が未設定のため通知を送れません。');
    return { sent: 0, failed: rows.length };
  }
  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    rows.map(async (row) => {
      const sub: PushSubscriptionData = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
      const result = await sendWebPush(sub, body, vapid);
      // 端末側で通知をやめた・アプリを消した場合は登録を消す
      if (result.gone) await query('DELETE FROM push_subscriptions WHERE id = $1', [row.id]);
      if (!result.ok) throw new Error(`push failed: ${result.status}`);
    }),
  );
  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return { sent, failed: results.length - sent };
}

/** 指定した従業員の端末すべてに通知する */
export async function notifyEmployees(employeeIds: number[], payload: NotificationPayload) {
  if (employeeIds.length === 0) return { sent: 0, failed: 0 };
  await ensureNotificationTables();
  const { rows } = await query(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE role = 'employee' AND employee_id = ANY($1::int[])`,
    [employeeIds],
  );
  return sendToRows(rows, payload);
}

/** 管理者として登録した端末すべてに通知する */
export async function notifyAdmins(payload: NotificationPayload) {
  await ensureNotificationTables();
  const { rows } = await query(`SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE role = 'admin'`);
  return sendToRows(rows, payload);
}

/** 一度だけ送りたい通知の記録。まだ送っていなければ記録して true を返す */
export async function markOnce(kind: string, key: string): Promise<boolean> {
  await ensureNotificationTables();
  const { rowCount } = await query(
    'INSERT INTO notification_log (kind, key) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [kind, key],
  );
  return (rowCount ?? 0) > 0;
}

// ---- 日付まわり（日本時間で判定する） ----

/** 日本時間の今日を YYYY-MM-DD で返す */
export function todayInJapan(now = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** a から b まで何日あるか（どちらも YYYY-MM-DD） */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / (24 * 60 * 60 * 1000));
}

/** 締切の何日前に知らせるか */
export const REMINDER_DAYS_BEFORE = [3, 1];

/** 今日がリマインドを送る日なら「何日前か」を、そうでなければ null を返す */
export function reminderDayFor(deadline: string, today: string): number | null {
  const days = daysBetween(today, deadline);
  return REMINDER_DAYS_BEFORE.includes(days) ? days : null;
}

/** 2026-10-20 → 10/20 */
export function shortDate(date: string): string {
  const [, m, d] = date.slice(0, 10).split('-');
  return `${Number(m)}/${Number(d)}`;
}
