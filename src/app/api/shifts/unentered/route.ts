import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';

export async function GET() {
  try {
    const sql = `
      SELECT 
        s.id as shift_id,
        s.date,
        s.start_time,
        s.end_time,
        e.name as employee_name,
        e.id as employee_id
      FROM shifts s
      JOIN employees e ON s.employee_id = e.id
      LEFT JOIN actual_work_hours a ON s.id = a.shift_id
      WHERE s.date < CURRENT_DATE
        AND s.start_time IS NOT NULL
        AND s.start_time != ''
        AND (a.id IS NULL OR a.actual_start_time IS NULL OR a.actual_start_time = '')
      ORDER BY s.date ASC, e.id ASC
    `;
    const result = await query(sql);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch unentered shifts:', error);
    return NextResponse.json({ error: 'Failed to fetch unentered shifts' }, { status: 500 });
  }
}
