/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, NextRequest } from 'next/server';
import { query } from '@/lib/db.mjs';
import bcrypt from 'bcrypt';

// GET handler to fetch a single employee by ID
export async function GET(request: NextRequest, { params }: any) {
  try {
    const sql = 'SELECT id, name, hourly_wage, max_weekly_hours, max_weekly_days, annual_income_limit, default_work_hours, request_type, created_at, initial_income, initial_income_year FROM employees WHERE id = $1';
    const result = await query(sql, [params.id]);
    const employee = result.rows[0];

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }
    return NextResponse.json(employee);
  } catch (error) {
    console.error(`Failed to fetch employee:`, error);
    return NextResponse.json({ error: 'Failed to fetch employee' }, { status: 500 });
  }
}

// PUT handler to update an employee
export async function PUT(request: NextRequest, { params }: any) {
  try {
    const employeeData = await request.json();
    const { name, hourly_wage, max_weekly_hours, max_weekly_days, annual_income_limit, password, default_work_hours, request_type } = employeeData;

    if (!name || !hourly_wage) {
      return NextResponse.json({ error: '名前と時給は必須です。' }, { status: 400 });
    }

    const updateFields = [];
    const queryParams = [];
    let paramIndex = 1;

    // 動的にクエリを構築
    updateFields.push(`name = $${paramIndex++}`);
    queryParams.push(name);
    updateFields.push(`hourly_wage = $${paramIndex++}`);
    queryParams.push(hourly_wage);
    updateFields.push(`max_weekly_hours = $${paramIndex++}`);
    queryParams.push(max_weekly_hours);
    updateFields.push(`max_weekly_days = $${paramIndex++}`);
    queryParams.push(max_weekly_days);
    updateFields.push(`annual_income_limit = $${paramIndex++}`);
    queryParams.push(annual_income_limit);
    updateFields.push(`default_work_hours = $${paramIndex++}`);
    queryParams.push(default_work_hours);
    updateFields.push(`request_type = $${paramIndex++}`);
    queryParams.push(request_type);

    if (password) {
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);
      updateFields.push(`password_hash = $${paramIndex++}`);
      queryParams.push(password_hash);
    }

    const sql = `UPDATE employees SET ${updateFields.join(', ')} WHERE id = $${paramIndex++}`;
    queryParams.push(params.id);

    const result = await query(sql, queryParams);

    if (result.rowCount === 0) {
        return NextResponse.json({ error: '従業員が見つからないか、更新されませんでした。' }, { status: 404 });
    }

    return NextResponse.json({ message: '従業員情報を更新しました。' });

  } catch (error) {
    console.error(`Failed to update employee ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
  }
}

// DELETE handler to remove an employee
export async function DELETE(request: NextRequest, { params }: any) {
  try {
    const sql = 'DELETE FROM employees WHERE id = $1';
    const result = await query(sql, [params.id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: '従業員が見つかりません。' }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });

  } catch (error) {
    console.error(`Failed to delete employee ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
  }
}r) {
    console.error(`Failed to delete employee ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
  }
}