import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Function to generate a secure token
const generateToken = () => crypto.randomBytes(32).toString('hex');

export async function POST(request: Request) {
  try {
    const { employeeId, password, rememberMe } = await request.json();

    if (!employeeId || !password) {
      return NextResponse.json({ error: '従業員IDとパスワードは必須です。' }, { status: 400 });
    }

    const result = await query(
      'SELECT id, name, password_hash, request_type FROM employees WHERE id = $1',
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

    // Password is valid, handle token generation if rememberMe is true
    let authToken = null;
    if (rememberMe) {
        authToken = generateToken();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
        await query(
            'INSERT INTO auth_tokens (token, employee_id, expires_at) VALUES ($1, $2, $3)',
            [authToken, employee.id, expiresAt]
        );
    }

    const userData = {
      id: employee.id,
      name: employee.name,
      isAdmin: false,
      request_type: employee.request_type,
    };

    return NextResponse.json({ user: userData, token: authToken, message: 'Login successful' });

  } catch (error) {
    console.error('Employee login failed:', error);
    return NextResponse.json({ error: 'An unknown error occurred' }, { status: 500 });
  }
}