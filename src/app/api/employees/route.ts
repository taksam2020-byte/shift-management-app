import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';
import bcrypt from 'bcrypt';
import { checkRole, getSession } from '@/lib/auth';

const ADMIN_COLUMNS = 'id, name, hourly_wage, group_name, max_weekly_hours, max_weekly_days, annual_income_limit, default_work_hours, request_type, created_at, initial_income, initial_income_year, hire_date, is_active';
// 管理者以外に見せてよい項目（時給・年収上限などは含めない）
const PUBLIC_COLUMNS = 'id, name, group_name, default_work_hours, request_type';

// GET handler to fetch employees, ordered by ID
// - 未ログイン: ログイン画面用に「在籍中の ID と名前」だけ
// - 従業員・閲覧者: シフト表示に必要な項目だけ
// - 管理者: すべての項目
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user = await getSession(request);
    const isAdmin = user?.role === 'admin';
    const includeInactive = isAdmin && searchParams.get('include_inactive') === 'true';

    const columns = !user ? 'id, name' : isAdmin ? ADMIN_COLUMNS : PUBLIC_COLUMNS;
    const condition = includeInactive ? '' : 'WHERE is_active = TRUE OR is_active IS NULL';
    const sql = `SELECT ${columns} FROM employees ${condition} ORDER BY id`;

    const { rows: employees } = await query(sql);
    return NextResponse.json(employees);
  } catch (error) {
    console.error('Failed to fetch employees:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch employees', details: errorMessage }, { status: 500 });
  }
}

// POST handler to create a new employee
export async function POST(request: Request) {
  const auth = await checkRole(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const employeeData = await request.json();
    const { id, name, hourly_wage, group_name, max_weekly_hours, max_weekly_days, annual_income_limit, password, default_work_hours, request_type, initial_income, initial_income_year, hire_date, is_active } = employeeData;

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

    const activeStatus = is_active !== undefined ? is_active : true;

    const sql = `
      INSERT INTO employees (id, name, hourly_wage, group_name, max_weekly_hours, max_weekly_days, annual_income_limit, password_hash, default_work_hours, request_type, initial_income, initial_income_year, hire_date, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id
    `;
    const params = [id, name, hourly_wage, group_name, max_weekly_hours, max_weekly_days, annual_income_limit, password_hash, default_work_hours, request_type || 'holiday', initial_income ?? null, initial_income_year ?? null, hire_date || null, activeStatus];

    const result = await query(sql, params);
    const newId = result.rows[0]?.id;

    if (newId) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _password, ...returnData } = employeeData;
        return NextResponse.json({ ...returnData, id: newId, is_active: activeStatus }, { status: 201 });
    } else {
        throw new Error('従業員の作成に失敗しました。');
    }

  } catch (error) {
    console.error('Failed to create employee:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to create employee', details: errorMessage }, { status: 500 });
  }
}
