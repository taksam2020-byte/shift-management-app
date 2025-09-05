import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';

// GET handler to fetch shifts, filtered by date range and/or employee
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const employeeId = searchParams.get('employeeId');

  try {
    const db = await getDb();
    // The query now joins with actual_work_hours to get submitted data, including break_hours
    let query = `
      SELECT 
        s.id, s.employee_id, s.date, s.start_time, s.end_time,
        a.id as actual_id, a.actual_start_time, a.actual_end_time, a.break_hours
      FROM shifts s
      LEFT JOIN actual_work_hours a ON s.id = a.shift_id
    `;
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (startDate && endDate) {
      conditions.push('s.date BETWEEN ? AND ?');
      params.push(startDate, endDate);
    }
    if (employeeId) {
      conditions.push('s.employee_id = ?');
      params.push(employeeId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY s.date, s.start_time';

    const shifts = await db.all(query, params);
    return NextResponse.json(shifts);
  } catch (error) {
    console.error('Failed to fetch shifts:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch shifts', details: errorMessage }, { status: 500 });
  }
}

// POST handler to save/update multiple shifts
export async function POST(request: Request) {
  try {
    const shiftsToSave: { employee_id: number; date: string; start_time: string; end_time: string; }[] = await request.json();

    if (!Array.isArray(shiftsToSave)) {
        return NextResponse.json({ error: 'Expected an array of shift objects' }, { status: 400 });
    }

    const db = await getDb();
    await db.run('BEGIN TRANSACTION');

    try {
        for (const shift of shiftsToSave) {
            const { employee_id, date, start_time, end_time } = shift;

            const existingShift = await db.get(
                'SELECT id FROM shifts WHERE employee_id = ? AND date = ?',
                [employee_id, date]
            );

            if (existingShift) {
                if (!start_time || !end_time) {
                    await db.run('DELETE FROM shifts WHERE id = ?', [existingShift.id]);
                } else {
                    await db.run(
                        'UPDATE shifts SET start_time = ?, end_time = ? WHERE id = ?',
                        [start_time, end_time, existingShift.id]
                    );
                }
            } else if (start_time && end_time) {
                await db.run(
                    'INSERT INTO shifts (employee_id, date, start_time, end_time) VALUES (?, ?, ?, ?)',
                    [employee_id, date, start_time, end_time]
                );
            }
        }
        await db.run('COMMIT');
        return NextResponse.json({ message: 'Shifts saved successfully' }, { status: 200 });
    } catch (innerError) {
        await db.run('ROLLBACK');
        throw innerError;
    }

  } catch (error) {
    console.error('Failed to save shifts:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to save shifts', details: errorMessage }, { status: 500 });
  }
}