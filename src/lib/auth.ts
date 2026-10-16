// ログイン状態（セッション）をサーバー側で管理する仕組み。
// ログイン時に署名付きのクッキーを発行し、各APIはそのクッキーを検証して
// 「誰が」「どの権限で」アクセスしているかを確認する。
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';

export type Role = 'admin' | 'employee' | 'viewer';

export interface SessionUser {
  role: Role;
  /** 従業員ID（管理者・閲覧者は 0） */
  id: number;
  name: string;
  request_type?: 'holiday' | 'work';
}

interface SessionPayload extends SessionUser {
  exp: number; // 有効期限（UNIX ミリ秒）
}

/** 画面側（localStorage の loggedInUser）で使っている形に変換する */
export function toClientUser(user: SessionUser) {
  return {
    id: user.id,
    name: user.name,
    isAdmin: user.role === 'admin',
    isViewer: user.role === 'viewer',
    request_type: user.request_type,
  };
}

export const SESSION_COOKIE = 'shiftkun_session';
export const SESSION_MAX_AGE_DAYS: Record<Role, number> = { admin: 7, employee: 30, viewer: 30 };

function getSecret(): string {
  // 専用の AUTH_SECRET が無い場合は、すでに秘密情報として設定されている DB 接続文字列を鍵に使う
  const secret = process.env.AUTH_SECRET || process.env.POSTGRES_URL;
  if (!secret) throw new Error('AUTH_SECRET（または POSTGRES_URL）が設定されていません。');
  return secret;
}

const sign = (data: string) => crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');

export function createSessionToken(user: SessionUser, now = Date.now()): string {
  const payload: SessionPayload = { ...user, exp: now + SESSION_MAX_AGE_DAYS[user.role] * 24 * 60 * 60 * 1000 };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data)}`;
}

export function verifySessionToken(token: string | undefined | null, now = Date.now()): SessionUser | null {
  if (!token) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = sign(data);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as SessionPayload;
    if (typeof payload.exp !== 'number' || payload.exp < now) return null;
    if (!['admin', 'employee', 'viewer'].includes(payload.role)) return null;
    return { role: payload.role, id: payload.id, name: payload.name, request_type: payload.request_type };
  } catch {
    return null;
  }
}

/** 文字列を時間差の出ない方法で比較する（パスワード照合用） */
export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

/**
 * リクエストのセッションを取得する。従業員の場合は退職済みでないかも毎回確認する。
 */
export async function getSession(request: Request): Promise<SessionUser | null> {
  const user = verifySessionToken(readCookie(request, SESSION_COOKIE));
  if (!user) return null;
  if (user.role === 'employee') {
    const { rows } = await query('SELECT is_active FROM employees WHERE id = $1', [user.id]);
    if (rows.length === 0 || rows[0].is_active === false) return null;
  }
  return user;
}

export function setSessionCookie(response: NextResponse, user: SessionUser): NextResponse {
  response.cookies.set(SESSION_COOKIE, createSessionToken(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_DAYS[user.role] * 24 * 60 * 60,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}

/**
 * 指定した権限のどれかでログインしていることを確認する。満たさなければ AuthError を投げる。
 */
export async function requireRole(request: Request, ...roles: Role[]): Promise<SessionUser> {
  const user = await getSession(request);
  if (!user) throw new AuthError(401, 'ログインしてください。');
  if (roles.length > 0 && !roles.includes(user.role)) throw new AuthError(403, 'この操作を行う権限がありません。');
  return user;
}

/**
 * API の先頭で使う権限チェック。OK ならユーザー、NG なら 401/403 のレスポンスを返す。
 *   const auth = await checkRole(request, 'admin');
 *   if (auth instanceof NextResponse) return auth;
 */
export async function checkRole(request: Request, ...roles: Role[]): Promise<SessionUser | NextResponse> {
  try {
    return await requireRole(request, ...roles);
  } catch (error) {
    const res = authErrorResponse(error);
    if (res) return res;
    console.error('Auth check failed:', error);
    return NextResponse.json({ error: '認証の確認に失敗しました。' }, { status: 500 });
  }
}

/** AuthError を 401/403 のレスポンスに変換する。それ以外は null */
export function authErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}
