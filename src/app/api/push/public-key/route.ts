import { NextResponse } from 'next/server';

// 端末が通知を登録するときに使う公開鍵（秘密ではない情報）
export async function GET() {
  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
}
