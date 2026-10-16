import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';
import bcrypt from 'bcrypt';
import { setSessionCookie, toClientUser, SessionUser } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { employeeId, password } = await request.json();

    if (!employeeId || !password) {
      return NextResponse.json({ error: '従業員IDとパスワードは必須です。' }, { status: 400 });
    }

    const result = await query(
      'SELECT id, name, password_hash, request_type, is_active FROM employees WHERE id = $1',
      [employeeId]
    );
    const employee = result.rows[0];

    // 退職済みの従業員はログインできない
    if (!employee || employee.is_active === false) {
      return NextResponse.json({ error: '従業員が見つかりません。' }, { status: 404 });
    }

    if (!employee.password_hash) {
        return NextResponse.json({ error: 'パスワードが設定されていません。管理者に連絡してください。' }, { status: 400 });
    }

    const isPasswordValid = await bcrypt.compare(password, employee.password_hash);

    if (!isPasswordValid) {
      return NextResponse.json({ error: 'パスワードが違います。' }, { status: 401 });
    }

    // ログイン状態は署名付きクッキーで30日間保持する
    const user: SessionUser = {
      role: 'employee',
      id: employee.id,
      name: employee.name,
      request_type: employee.request_type,
    };

    const response = NextResponse.json({ user: toClientUser(user), message: 'Login successful' });
    return setSessionCookie(response, user);

  } catch (error) {
    console.error('Employee login failed:', error);
    return NextResponse.json({ error: 'An unknown error occurred' }, { status: 500 });
  }
}
