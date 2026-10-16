import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';
import { checkRole } from '@/lib/auth';
import { ensureNotificationTables } from '@/lib/notify';

interface SubscribeBody {
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
}

// この端末で通知を受け取る（ログイン中の人に紐づけて登録する）
export async function POST(request: Request) {
  const auth = await checkRole(request, 'admin', 'employee');
  if (auth instanceof NextResponse) return auth;

  const { subscription }: SubscribeBody = await request.json().catch(() => ({}));
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const authKey = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !authKey || !endpoint.startsWith('https://')) {
    return NextResponse.json({ error: '通知の登録情報が正しくありません。' }, { status: 400 });
  }

  try {
    await ensureNotificationTables();
    await query(
      `INSERT INTO push_subscriptions (role, employee_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint) DO UPDATE SET role = EXCLUDED.role, employee_id = EXCLUDED.employee_id,
         p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [auth.role, auth.role === 'employee' ? auth.id : null, endpoint, p256dh, authKey],
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to save push subscription:', error);
    return NextResponse.json({ error: '通知の登録に失敗しました。' }, { status: 500 });
  }
}

// この端末の通知をやめる
export async function DELETE(request: Request) {
  const auth = await checkRole(request, 'admin', 'employee');
  if (auth instanceof NextResponse) return auth;

  const { endpoint }: { endpoint?: string } = await request.json().catch(() => ({}));
  if (!endpoint) return NextResponse.json({ error: 'endpoint が必要です。' }, { status: 400 });

  try {
    await ensureNotificationTables();
    await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete push subscription:', error);
    return NextResponse.json({ error: '通知の解除に失敗しました。' }, { status: 500 });
  }
}
