import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import bcrypt from 'bcrypt';

// GET handler to fetch all employees, ordered by ID
export async function GET() {
  try {
    const db = await getDb();
    const employees = await db.all('SELECT * FROM employees ORDER BY id');
    return NextResponse.json(employees);
  } catch (error) {
    console.error('Failed to fetch employees:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch employees', details: errorMessage }, { status: 500 });
  }
}

// POST handler to create a new employee
export async function POST(request: Request) {
  try {
    const employeeData = await request.json();
    const { name, hourly_wage, max_weekly_hours, max_weekly_days, annual_income_limit, password, default_work_hours, request_type } = employeeData;

    if (!name || !hourly_wage) {
      return NextResponse.json({ error: 'Name and hourly wage are required' }, { status: 400 });
    }

    let password_hash = null;
    if (password) {
      const saltRounds = 10;
      password_hash = await bcrypt.hash(password, saltRounds);
    }

    const db = await getDb();
    const result = await db.run(
      'INSERT INTO employees (name, hourly_wage, max_weekly_hours, max_weekly_days, annual_income_limit, password_hash, default_work_hours, request_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, hourly_wage, max_weekly_hours, max_weekly_days, annual_income_limit, password_hash, default_work_hours, request_type || 'holiday']
    );

    if (result.lastID) {
        // Do not return password data
        const { ...returnData } = employeeData;
        return NextResponse.json({ id: result.lastID, ...returnData }, { status: 201 });
        throw new Error('Failed to get last inserted ID.');
    }

  } catch (error) {
    console.error('Failed to create employee:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to create employee', details: errorMessage }, { status: 500 });
  }
}
