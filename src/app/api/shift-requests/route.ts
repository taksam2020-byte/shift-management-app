import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';

// GET handler to fetch shift requests
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    const db = await getDb();
    // FIX: Select the new request_type column
    let query = 'SELECT sr.id, sr.employee_id, sr.date, sr.notes, sr.request_type, e.name as employee_name FROM shift_requests sr JOIN employees e ON sr.employee_id = e.id';
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (employeeId) {
      conditions.push('sr.employee_id = ?');
      params.push(employeeId);
    }
    if (startDate && endDate) {
      conditions.push('sr.date BETWEEN ? AND ?');
      params.push(startDate, endDate);
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY sr.date';

    const requests = await db.all(query, params);
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
    // FIX: Use request_type instead of is_off_request
    const { employee_id, date, notes, request_type } = requestData;

    if (!employee_id || !date || !request_type) {
      return NextResponse.json({ error: 'Employee ID, date, and request type are required' }, { status: 400 });
    }

    const db = await getDb();
    const existing = await db.get('SELECT id FROM shift_requests WHERE employee_id = ? AND date = ?', [employee_id, date]);
    if (existing) {
        return NextResponse.json({ error: 'A request for this date already exists.' }, { status: 409 });
    }

    const result = await db.run(
      'INSERT INTO shift_requests (employee_id, date, notes, request_type) VALUES (?, ?, ?, ?)',
      [employee_id, date, notes, request_type]
    );

    if (result.lastID) {
        return NextResponse.json({ id: result.lastID, ...requestData }, { status: 201 });
    } else {
        throw new Error('Failed to get last inserted ID.');
    }
  } catch (error) {
    console.error('Failed to create shift request:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to create shift request', details: errorMessage }, { status: 500 });
  }
}

// DELETE a shift request (unchanged)
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Request ID parameter is required' }, { status: 400 });
  }

  try {
    const db = await getDb();
    const result = await db.run('DELETE FROM shift_requests WHERE id = ?', [id]);
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete shift request:', error);
    return NextResponse.json({ error: 'Failed to delete shift request' }, { status: 500 });
  }
}
