import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';
import bcrypt from 'bcrypt';

export async function POST(request: Request) {
  try {
    const { employeeId, password } = await request.json();

    if (!employeeId || !password) {
      return NextResponse.json({ error: '従業員IDとパスワードは必須です。' }, { status: 400 });
    }

    const result = await query(
      'SELECT id, name, password_hash FROM employees WHERE id = $1',
      [employeeId]
    );
    const employee = result.rows[0];

    if (!employee) {
      return NextResponse.json({ error: '従業員が見つかりません。' }, { status: 404 });
    }

    if (!employee.password_hash) {
        return NextResponse.json({ error: 'パスワードが設定されていません。管理者に連絡してください。' }, { status: 400 });
    }

    const isPasswordValid = await bcrypt.compare(password, employee.password_hash);

    if (!isPasswordValid) {
      return NextResponse.json({ error: 'パスワードが違います。' }, { status: 401 });
    }

    // Password is valid, return user data (without password hash)
    const userData = {
      id: employee.id,
      name: employee.name,
      isAdmin: false, // Employees are never admins
    };

    return NextResponse.json({ user: userData, message: 'Login successful' });

  } catch (error) {
    console.error('Employee login failed:', error);
    return NextResponse.json({ error: 'An unknown error occurred' }, { status: 500 });
  }
}