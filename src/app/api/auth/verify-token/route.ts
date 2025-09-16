import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const tokenResult = await query(
      'SELECT employee_id, expires_at FROM auth_tokens WHERE token = $1',
      [token]
    );

    const authToken = tokenResult.rows[0];

    if (!authToken || new Date(authToken.expires_at) < new Date()) {
      // Token not found or expired, delete it if it exists
      if (authToken) {
        await query('DELETE FROM auth_tokens WHERE token = $1', [token]);
      }
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Token is valid, fetch user data
    const employeeResult = await query(
      'SELECT id, name, request_type FROM employees WHERE id = $1',
      [authToken.employee_id]
    );
    const employee = employeeResult.rows[0];

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found for this token' }, { status: 404 });
    }

    const userData = {
      id: employee.id,
      name: employee.name,
      isAdmin: false,
      request_type: employee.request_type,
    };

    return NextResponse.json({ user: userData });

  } catch (error) {
    console.error('Token verification failed:', error);
    return NextResponse.json({ error: 'An unknown error occurred' }, { status: 500 });
  }
}
