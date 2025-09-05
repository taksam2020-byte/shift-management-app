import { NextResponse } from 'next/server';

// In a real app, this would be in an environment variable
const ADMIN_PASSWORD = 'admin'; // Simple hardcoded password

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (password === ADMIN_PASSWORD) {
      // Return a success response with admin data
      return NextResponse.json({ 
        user: { name: '管理者', isAdmin: true }, 
        message: 'Login successful' 
      });
    } else {
      // Return an error for wrong password
      return NextResponse.json({ error: 'パスワードが違います。' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'An unknown error occurred' }, { status: 500 });
  }
}