import { NextResponse, NextRequest } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import bcrypt from 'bcrypt';

interface Context {
  params: {
    id: string;
  }
}

// GET handler to fetch a single employee by ID
export async function GET(request: NextRequest, context: Context) {
  const { params } = context;
  try {
    const db = await getDb();
    const employee = await db.get('SELECT * FROM employees WHERE id = ?', [params.id]);
    
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json(employee);
  } catch (error) {
    console.error(`Failed to fetch employee ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to fetch employee' }, { status: 500 });
  }
}

// PUT handler to update an employee
export async function PUT(request: NextRequest, context: Context) {
  const { params } = context;
  try {
    const employeeData = await request.json();
    const { name, hourly_wage, max_weekly_hours, max_weekly_days, annual_income_limit, password, default_work_hours, request_type } = employeeData;

    if (!name || !hourly_wage) {
      return NextResponse.json({ error: 'Name and hourly wage are required' }, { status: 400 });
    }

    const db = await getDb();
    
    let sql = 'UPDATE employees SET name = ?, hourly_wage = ?, max_weekly_hours = ?, max_weekly_days = ?, annual_income_limit = ?, default_work_hours = ?, request_type = ?';
    const queryParams: (string | number | null)[] = [name, hourly_wage, max_weekly_hours, max_weekly_days, annual_income_limit, default_work_hours, request_type];

    if (password) {
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);
      sql += ', password_hash = ?';
      queryParams.push(password_hash);
    }

    sql += ' WHERE id = ?';
    queryParams.push(params.id);

    const result = await db.run(sql, queryParams);

    if (result.changes === 0) {
        return NextResponse.json({ error: 'Employee not found or no changes made' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Employee updated successfully' });

  } catch (error) {
    console.error(`Failed to update employee ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
  }
}

// DELETE handler to remove an employee
export async function DELETE(request: NextRequest, context: Context) {
  const { params } = context;
  try {
    const db = await getDb();
    const result = await db.run('DELETE FROM employees WHERE id = ?', [params.id]);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });

  } catch (error) {
    console.error(`Failed to delete employee ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
  }
}