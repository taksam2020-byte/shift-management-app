import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';
import { safeEqual } from '@/lib/auth';
import {
  ensureNotificationTables,
  markOnce,
  notifyAdmins,
  notifyEmployees,
  reminderDayFor,
  shortDate,
  todayInJapan,
} from '@/lib/notify';

interface DeadlineRow {
  id: number;
  period_start: string;
  period_end: string;
  deadline: string;
}

/**
 * 毎日1回、決まった時刻に呼ばれる処理（Cloudflare の Cron Trigger / Vercel Cron）。
 * 希望休・希望出勤日の締切が近づいたら、まだ1日も提出していない従業員に知らせる。
 * 他の人が勝手に呼べないよう、CRON_SECRET を知っている呼び出しだけ受け付ける。
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!secret || !safeEqual(given, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureNotificationTables();
    const today = todayInJapan();
    const { rows: deadlines } = await query(
      `SELECT id, to_char(period_start, 'YYYY-MM-DD') AS period_start, to_char(period_end, 'YYYY-MM-DD') AS period_end,
              to_char(deadline, 'YYYY-MM-DD') AS deadline
       FROM request_deadlines WHERE deadline >= $1::date`,
      [today],
    );

    const report: { deadline: string; daysBefore: number; notified: number }[] = [];
    for (const d of deadlines as DeadlineRow[]) {
      const daysBefore = reminderDayFor(d.deadline, today);
      if (daysBefore === null) continue;
      // 同じ日に2回呼ばれても二重に送らない
      if (!(await markOnce('deadline', `${d.id}:${daysBefore}`))) continue;

      const { rows: pending } = await query(
        `SELECT e.id, e.request_type FROM employees e
         WHERE COALESCE(e.is_active, TRUE) = TRUE
           AND NOT EXISTS (
             SELECT 1 FROM shift_requests sr
             WHERE sr.employee_id = e.id AND sr.date BETWEEN $1::date AND $2::date
           )`,
        [d.period_start, d.period_end],
      );

      const period = `${shortDate(d.period_start)}〜${shortDate(d.period_end)}`;
      const when = daysBefore === 1 ? '明日' : `${daysBefore}日後`;
      const groups: Record<string, number[]> = { holiday: [], work: [] };
      for (const e of pending as { id: number; request_type: string | null }[]) {
        groups[e.request_type === 'work' ? 'work' : 'holiday'].push(e.id);
      }
      for (const [type, ids] of Object.entries(groups)) {
        const label = type === 'work' ? '希望出勤日' : '希望休';
        await notifyEmployees(ids, {
          title: `${label}の締切は${when}です`,
          body: `${period} の${label}の締切は ${shortDate(d.deadline)} です。希望がある場合は早めに提出してください。`,
          url: '/requests',
          tag: `deadline-${d.id}`,
        });
      }
      if (daysBefore === 1 && pending.length > 0) {
        await notifyAdmins({
          title: '希望の未提出者がいます',
          body: `${period} の締切（${shortDate(d.deadline)}）まで1日です。未提出：${pending.length}人`,
          url: '/admin/notifications',
          tag: `deadline-admin-${d.id}`,
        });
      }
      report.push({ deadline: d.deadline, daysBefore, notified: pending.length });
    }
    return NextResponse.json({ today, report });
  } catch (error) {
    console.error('Reminder job failed:', error);
    return NextResponse.json({ error: 'リマインドの処理に失敗しました。' }, { status: 500 });
  }
}
