import { NextResponse } from 'next/server';
import { safeEqual, setSessionCookie } from '@/lib/auth';

// 管理者パスワードは環境変数 ADMIN_PASSWORD で設定する（コードには書かない）
export async function POST(request: Request) {
  try {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return NextResponse.json(
        { error: '管理者パスワード（環境変数 ADMIN_PASSWORD）が設定されていません。README の手順で設定してください。' },
        { status: 503 }
      );
    }

    const { password } = await request.json();
    if (typeof password !== 'string' || !safeEqual(password, adminPassword)) {
      return NextResponse.json({ error: 'パスワードが違います。' }, { status: 401 });
    }

    const user = { role: 'admin' as const, id: 0, name: '管理者' };
    const response = NextResponse.json({ user: { id: 0, name: user.name, isAdmin: true }, message: 'Login successful' });
    return setSessionCookie(response, user);
  } catch {
    return NextResponse.json({ error: 'An unknown error occurred' }, { status: 500 });
  }
}
