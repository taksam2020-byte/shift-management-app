import { NextResponse } from 'next/server';
import { getSession, toClientUser } from '@/lib/auth';

// 現在ログインしているユーザーを返す（画面側のログイン判定に使う）
export async function GET(request: Request) {
  try {
    const user = await getSession(request);
    if (!user) return NextResponse.json({ user: null }, { status: 401 });
    return NextResponse.json({ user: toClientUser(user) });
  } catch (error) {
    console.error('Session check failed:', error);
    return NextResponse.json({ error: 'An unknown error occurred' }, { status: 500 });
  }
}
