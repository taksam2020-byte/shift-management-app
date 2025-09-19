import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';
import bcrypt from 'bcrypt';

// GET handler to fetch all employees, ordered by ID
export async function GET() {
  try {
    const { rows: employees } = await query('SELECT id, name, hourly_wage, group_name, max_weekly_hours, max_weekly_days, annual_income_limit, default_work_hours, request_type, created_at, initial_income, initial_income_year FROM employees ORDER BY id');
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
    const { id, name, hourly_wage, group_name, max_weekly_hours, max_weekly_days, annual_income_limit, password, default_work_hours, request_type } = employeeData;

    if (!id || !name || !hourly_wage || !password) {
      return NextResponse.json({ error: '従業員ID、氏名、時給、パスワードは必須です。' }, { status: 400 });
    }

    // Check for duplicate ID
    const existingEmployee = await query('SELECT id FROM employees WHERE id = $1', [id]);
    if (existingEmployee.rows.length > 0) {
      return NextResponse.json({ error: 'この従業員IDは既に使用されています。' }, { status: 409 });
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const sql = `
      INSERT INTO employees (id, name, hourly_wage, group_name, max_weekly_hours, max_weekly_days, annual_income_limit, password_hash, default_work_hours, request_type) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `;
    const params = [id, name, hourly_wage, group_name, max_weekly_hours, max_weekly_days, annual_income_limit, password_hash, default_work_hours, request_type || 'holiday'];
    
    const result = await query(sql, params);
    const newId = result.rows[0]?.id;

    if (newId) {
        const { password, ...returnData } = employeeData;
        return NextResponse.json({ id: newId, ...returnData }, { status: 201 });
    } else {
        throw new Error('従業員の作成に失敗しました。');
    }

  } catch (error) {
    console.error('Failed to create employee:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to create employee', details: errorMessage }, { status: 500 });
  }
}
