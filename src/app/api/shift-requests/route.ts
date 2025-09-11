import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';

// GET handler to fetch shift requests
export async function GET(request: Request) {
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

// POST handler to create a new shift request
export async function POST(request: Request) {
  try {
    const requestData = await request.json();
    const { employee_id, date, notes, request_type } = requestData;

    if (!employee_id || !date || !request_type) {
      return NextResponse.json({ error: 'Employee ID, date, and request type are required' }, { status: 400 });
    }

    const existingResult = await query('SELECT id FROM shift_requests WHERE employee_id = $1 AND date = $2', [employee_id, date]);
    if (existingResult.rows.length > 0) {
        return NextResponse.json({ error: 'A request for this date already exists.' }, { status: 409 });
    }

    const insertSql = `
      INSERT INTO shift_requests (employee_id, date, notes, request_type) 
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    const result = await query(insertSql, [employee_id, date, notes, request_type]);
    const newId = result.rows[0]?.id;

    if (newId) {
        return NextResponse.json({ id: newId, ...requestData }, { status: 201 });
    } else {
        throw new Error('Failed to get last inserted ID.');
    }
  } catch (error) {
    console.error('Failed to create shift request:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to create shift request', details: errorMessage }, { status: 500 });
  }
}

// DELETE a shift request
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Request ID parameter is required' }, { status: 400 });
  }

  try {
    const result = await query('DELETE FROM shift_requests WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete shift request:', error);
    return NextResponse.json({ error: 'Failed to delete shift request' }, { status: 500 });
  }
}