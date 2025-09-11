import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';

// POST handler to create or update actual work hours
export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { shift_id, actual_start_time, actual_end_time, break_hours } = data;

    if (!shift_id || !actual_start_time || !actual_end_time) {
      return NextResponse.json({ error: 'Shift ID and start/end times are required' }, { status: 400 });
    }

    const breakHoursToSave = (typeof break_hours === 'number' && break_hours >= 0) ? break_hours : 1;

    const existingResult = await query(
      'SELECT id FROM actual_work_hours WHERE shift_id = $1',
      [shift_id]
    );
    const existing = existingResult.rows[0];

    if (existing) {
      // Update existing entry
      await query(
        'UPDATE actual_work_hours SET actual_start_time = $1, actual_end_time = $2, break_hours = $3 WHERE id = $4',
        [actual_start_time, actual_end_time, breakHoursToSave, existing.id]
      );
    } else {
      // Insert new entry (fixed to include break_hours)
      await query(
        'INSERT INTO actual_work_hours (shift_id, actual_start_time, actual_end_time, break_hours) VALUES ($1, $2, $3, $4)',
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
