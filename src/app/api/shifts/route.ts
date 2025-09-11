import { NextResponse } from 'next/server';
import { getDb, query } from '@/lib/db.mjs';

// GET handler to fetch shifts, filtered by date range and/or employee
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const employeeId = searchParams.get('employeeId');

  try {
    let sql = `
      SELECT 
        s.id, s.employee_id, s.date, s.start_time, s.end_time,
        a.id as actual_id, a.actual_start_time, a.actual_end_time, a.break_hours
      FROM shifts s
      LEFT JOIN actual_work_hours a ON s.id = a.shift_id
    `;
    const params: (string | number)[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (startDate && endDate) {
      conditions.push(`s.date BETWEEN ${paramIndex++}::date AND ${paramIndex++}::date`);
      params.push(startDate, endDate);
    }
    if (employeeId) {
      conditions.push(`s.employee_id = $${paramIndex++}`);
      params.push(employeeId);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY s.date, s.start_time';

    const { rows: shifts } = await query(sql, params);
    return NextResponse.json(shifts);
  } catch (error) {
    console.error('Failed to fetch shifts:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch shifts', details: errorMessage }, { status: 500 });
  }
}

// POST handler to save/update multiple shifts
export async function POST(request: Request) {
  const pool = getDb();
  const client = await pool.connect(); // トランザクションのためにクライアントを取得

  try {
    const shiftsToSave: { employee_id: number; date: string; start_time: string; end_time: string; }[] = await request.json();

    if (!Array.isArray(shiftsToSave)) {
        return NextResponse.json({ error: 'Expected an array of shift objects' }, { status: 400 });
    }

    await client.query('BEGIN'); // トランザクション開始

    try {
        for (const shift of shiftsToSave) {
            const { employee_id, date, start_time, end_time } = shift;

            const existingResult = await client.query(
                'SELECT id FROM shifts WHERE employee_id = $1 AND date = $2',
                [employee_id, date]
            );
            const existingShift = existingResult.rows[0];

            if (existingShift) {
                if (!start_time || !end_time) {
                    await client.query('DELETE FROM shifts WHERE id = $1', [existingShift.id]);
                } else {
                    await client.query(
                        'UPDATE shifts SET start_time = $1, end_time = $2 WHERE id = $3',
                        [start_time, end_time, existingShift.id]
                    );
                }
            } else if (start_time && end_time) {
                await client.query(
                    'INSERT INTO shifts (employee_id, date, start_time, end_time) VALUES ($1, $2, $3, $4)',
                    [employee_id, date, start_time, end_time]
                );
            }
        }
        await client.query('COMMIT'); // 正常終了時にコミット
        return NextResponse.json({ message: 'Shifts saved successfully' }, { status: 200 });
    } catch (innerError) {
        await client.query('ROLLBACK'); // エラー発生時にロールバック
        throw innerError;
    }

  } catch (error) {
    console.error('Failed to save shifts:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to save shifts', details: errorMessage }, { status: 500 });
  } finally {
      client.release(); // 最後に必ずクライアントをプールに返却
  }
}
