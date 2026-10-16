import { NextResponse } from 'next/server';
import { getDb, query } from '@/lib/db.mjs';
import { checkRole } from '@/lib/auth';

// GET handler to fetch shift requests
export async function GET(request: Request) {
  const auth = await checkRole(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    let sql = 'SELECT sr.id, sr.employee_id, sr.date, sr.notes, sr.request_type, e.name as employee_name FROM shift_requests sr JOIN employees e ON sr.employee_id = e.id';
    const params: (string | number)[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (employeeId) {
      conditions.push(`sr.employee_id = $${paramIndex++}`);
      params.push(employeeId);
    }
    if (startDate && endDate) {
      conditions.push(`sr.date BETWEEN $${paramIndex++} AND $${paramIndex++}`);
      params.push(startDate, endDate);
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY sr.date';

    const { rows: requests } = await query(sql, params);
    return NextResponse.json(requests);
  } catch (error) {
    console.error('Failed to fetch shift requests:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch shift requests', details: errorMessage }, { status: 500 });
  }
}

// POST handler to create a new shift request（従業員は自分の分だけ）
export async function POST(request: Request) {
  const auth = await checkRole(request, 'admin', 'employee');
  if (auth instanceof NextResponse) return auth;

  try {
    const requestData = await request.json();
    const { employee_id, date, notes, request_type } = requestData;

    if (!employee_id || !date || !request_type) {
      return NextResponse.json({ error: 'Employee ID, date, and request type are required' }, { status: 400 });
    }
    if (auth.role === 'employee' && Number(employee_id) !== auth.id) {
      return NextResponse.json({ error: '他の人の希望は提出できません。' }, { status: 403 });
    }

    const existingResult = await query('SELECT id FROM shift_requests WHERE employee_id = $1 AND date = $2', [employee_id, date]);
    if (existingResult.rows.length > 0) {
        return NextResponse.json({ error: 'A request for this date already exists.' }, { status: 409 });
    }

    const result = await query(
      'INSERT INTO shift_requests (employee_id, date, notes, request_type) VALUES ($1, $2, $3, $4) RETURNING id',
      [employee_id, date, notes, request_type]
    );
    return NextResponse.json({ id: result.rows[0]?.id, ...requestData }, { status: 201 });
  } catch (error) {
    console.error('Failed to create shift request:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to create shift request', details: errorMessage }, { status: 500 });
  }
}

// DELETE a shift request（従業員は自分の分だけ）
export async function DELETE(request: Request) {
  const auth = await checkRole(request, 'admin', 'employee');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Request ID parameter is required' }, { status: 400 });
  }

  const client = await getDb().connect();

  try {
    await client.query('BEGIN');

    // First, get the request details before deleting it
    const requestResult = await client.query('SELECT employee_id, date FROM shift_requests WHERE id = $1', [id]);
    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    const { employee_id, date } = requestResult.rows[0];
    if (auth.role === 'employee' && employee_id !== auth.id) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: '他の人の希望は取り消せません。' }, { status: 403 });
    }

    // Then, find the corresponding shift
    const shiftResult = await client.query('SELECT id FROM shifts WHERE employee_id = $1 AND date = $2', [employee_id, date]);
    if (shiftResult.rows.length > 0) {
      const shiftId = shiftResult.rows[0].id;

      // Check if there are any actual work hours logged for this shift
      const actualsResult = await client.query('SELECT id FROM actual_work_hours WHERE shift_id = $1', [shiftId]);

      // If no actuals are logged, it's safe to delete the shift
      if (actualsResult.rows.length === 0) {
        await client.query('DELETE FROM shifts WHERE id = $1', [shiftId]);
      }
    }

    // Finally, delete the request itself
    await client.query('DELETE FROM shift_requests WHERE id = $1', [id]);

    await client.query('COMMIT');
    return new NextResponse(null, { status: 204 });

  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Failed to delete shift request:', error);
    return NextResponse.json({ error: 'Failed to delete shift request' }, { status: 500 });
  } finally {
    client.release();
  }
}
