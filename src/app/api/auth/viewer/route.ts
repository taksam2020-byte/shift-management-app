import { NextResponse } from 'next/server';
import { safeEqual, setSessionCookie } from '@/lib/auth';

// 閲覧専用ログイン。環境変数 VIEWER_PASSWORD を設定した場合のみパスワードを求める。
export async function POST(request: Request) {
  try {
    const viewerPassword = process.env.VIEWER_PASSWORD;
    if (viewerPassword) {
      const body = await request.json().catch(() => ({}));
      const password = typeof body.password === 'string' ? body.password : '';
      if (!safeEqual(password, viewerPassword)) {
        return NextResponse.json({ error: 'パスワードが違います。', passwordRequired: true }, { status: 401 });
      }
    }
    const response = NextResponse.json({ user: { id: 0, name: '閲覧者', isAdmin: false, isViewer: true } });
    return setSessionCookie(response, { role: 'viewer', id: 0, name: '閲覧者' });
  } catch {
    return NextResponse.json({ error: 'An unknown error occurred' }, { status: 500 });
  }
}
