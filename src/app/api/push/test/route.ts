import { NextResponse } from 'next/server';
import { checkRole } from '@/lib/auth';
import { notifyAdmins, notifyEmployees } from '@/lib/notify';

// 自分の端末にテスト通知を送る
export async function POST(request: Request) {
  const auth = await checkRole(request, 'admin', 'employee');
  if (auth instanceof NextResponse) return auth;

  const payload = {
    title: 'シフトくん',
    body: 'テスト通知です。この通知が見えていれば設定は完了です。',
    url: '/dashboard',
    tag: 'test',
  };
  try {
    const result = auth.role === 'admin' ? await notifyAdmins(payload) : await notifyEmployees([auth.id], payload);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to send test notification:', error);
    return NextResponse.json({ error: 'テスト通知の送信に失敗しました。' }, { status: 500 });
  }
}
