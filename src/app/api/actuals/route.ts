import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';

// POST handler to create or update actual work hours
export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { shift_id, actual_start_time, actual_end_time, break_hours } = data;

    if (!shift_id || !actual_start_time || !actual_end_time) {
      return NextResponse.json({ error: 'Shift ID and start/end times are required' }, { status: 400 });
    }

    const breakHoursToSave = (typeof break_hours === 'number' && break_hours >= 0) ? break_hours : 1;

    const db = await getDb();

    const existing = await db.get(
      'SELECT id FROM actual_work_hours WHERE shift_id = ?',
      [shift_id]
    );

    if (existing) {
      // Update existing entry
      await db.run(
        'UPDATE actual_work_hours SET actual_start_time = ?, actual_end_time = ?, break_hours = ? WHERE id = ?',
        [actual_start_time, actual_end_time, breakHoursToSave, existing.id]
      );
    } else {
      // Insert new entry
      await db.run(
        'INSERT INTO actual_work_hours (shift_id, actual_start_time, actual_end_time, break_hours) VALUES (?, ?, ?, ?)',
        [shift_id, actual_start_time, actual_end_time, breakHoursToSave]
      );
    }

    return NextResponse.json({ message: 'Actual hours saved successfully' }, { status: 200 });

  } catch (error) {
    console.error('Failed to save actual hours:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to save actual hours', details: errorMessage }, { status: 500 });
  }
}