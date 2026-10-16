import { NextResponse } from 'next/server';
import { checkRole } from '@/lib/auth';
import { notifyEmployees, shortDate } from '@/lib/notify';

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

// 管理者がシフトを保存したあと、変更があった従業員に知らせる
export async function POST(request: Request) {
  const auth = await checkRole(request, 'admin');
  if (auth instanceof NextResponse) return auth;

  const { employeeIds, startDate, endDate }: { employeeIds?: unknown; startDate?: unknown; endDate?: unknown } =
    await request.json().catch(() => ({}));
  const ids = Array.isArray(employeeIds) ? [...new Set(employeeIds.map(Number).filter(Number.isInteger))] : [];
  if (ids.length === 0 || !isDate(startDate) || !isDate(endDate)) {
    return NextResponse.json({ error: '通知する従業員と期間を指定してください。' }, { status: 400 });
  }

  const period = startDate === endDate ? shortDate(startDate) : `${shortDate(startDate)}〜${shortDate(endDate)}`;
  try {
    const result = await notifyEmployees(ids, {
      title: 'シフトが更新されました',
      body: `${period} のシフトが作成・変更されました。マイシフトで確認してください。`,
      url: '/my-schedule',
      tag: `shift-${startDate}`,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to send shift notification:', error);
    return NextResponse.json({ error: '通知の送信に失敗しました。' }, { status: 500 });
  }
}
