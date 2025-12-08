import { NextResponse } from 'next/server';
import { getDb, query } from '@/lib/db.mjs';

// GET handler, rewritten with robust date filtering
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const employeeId = searchParams.get('employeeId');

  try {
    const baseSql = `
      SELECT 
        s.id, s.employee_id, s.date, s.start_time, s.end_time,
        a.id as actual_id, a.actual_start_time, a.actual_end_time, a.break_hours
      FROM shifts s
      LEFT JOIN actual_work_hours a ON s.id = a.shift_id
    `;
    
    let sql = '';
    let params: (string | number)[] = [];

    if (startDate && endDate && employeeId) {
      sql = baseSql + ' WHERE s.date >= $1::date AND s.date <= $2::date AND s.employee_id = $3 ORDER BY s.date, s.start_time';
      params = [startDate, endDate, employeeId];
    } else if (startDate && endDate) {
      sql = baseSql + ' WHERE s.date >= $1::date AND s.date <= $2::date ORDER BY s.date, s.start_time';
      params = [startDate, endDate];
    } else if (employeeId) {
      sql = baseSql + ' WHERE s.employee_id = $1 ORDER BY s.date, s.start_time';
      params = [employeeId];
    } else {
      sql = baseSql + ' ORDER BY s.date, s.start_time';
      params = [];
    }

    const { rows: shifts } = await query(sql, params);
    return NextResponse.json(shifts);
    
  } catch (error) {
    console.error('Failed to fetch shifts:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch shifts', details: errorMessage }, { status: 500 });
  }
}

// POST handler - Rewritten for simplicity and robustness using UPSERT
export async function POST(request: Request) {
  const pool = getDb();
  const client = await pool.connect();

  try {
    const { shiftsToSave, force = false }: { shiftsToSave: { employee_id: number; date: string; start_time: string; end_time: string; }[], force?: boolean } = await request.json();

    if (!Array.isArray(shiftsToSave)) {
        return NextResponse.json({ error: 'Expected an array of shift objects' }, { status: 400 });
    }

    await client.query('BEGIN');

    try {
        for (const shift of shiftsToSave) {
            const { employee_id, date, start_time, end_time } = shift;
            
            // If start_time or end_time is empty, it's a delete request.
            if (!start_time || !end_time) {
                // Find the shift id to delete actuals first.
                const shiftResult = await client.query('SELECT id FROM shifts WHERE employee_id = $1 AND date = $2', [employee_id, date]);
                if (shiftResult.rows.length > 0) {
                    const shiftId = shiftResult.rows[0].id;
                    // Check for actuals and handle them
                    const actualsResult = await client.query('SELECT id FROM actual_work_hours WHERE shift_id = $1', [shiftId]);
                    if (actualsResult.rows.length > 0) {
                        if (force) {
                            await client.query('DELETE FROM actual_work_hours WHERE shift_id = $1', [shiftId]);
                        } else {
                            // Instead of throwing an error that rolls back everything, we can collect warnings.
                            // For simplicity, we'll throw for now. A more advanced implementation could return warnings.
                            throw new Error(`実績が入力済みのシフト(従業員ID: ${employee_id}, 日付: ${date})は削除できません。`);
                        }
                    }
                    // Finally, delete the shift itself.
                    await client.query('DELETE FROM shifts WHERE id = $1', [shiftId]);
                }
            } else {
                // Use UPSERT (INSERT ... ON CONFLICT DO UPDATE)
                const upsertSql = `
                    INSERT INTO shifts (employee_id, date, start_time, end_time)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (employee_id, date)
                    DO UPDATE SET start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time;
                `;
                await client.query(upsertSql, [employee_id, date, start_time, end_time]);
            }
        }
        
        await client.query('COMMIT');
        return NextResponse.json({ message: 'Shifts saved successfully' }, { status: 200 });
    } catch (innerError) {
        await client.query('ROLLBACK');
        throw innerError;
    }

  } catch (error) {
    console.error('Failed to save shifts:', error);
    const errorMessage = error instanceof Error ? error.message : '保存中にエラーが発生しました。';
    return NextResponse.json({ error: 'Failed to save shifts', details: errorMessage }, { status: 500 });
  } finally {
      client.release();
  }
}
