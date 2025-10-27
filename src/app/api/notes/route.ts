import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';

// GET handler to fetch notes for a given date range
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
  }

  const pool = getDb();
  const client = await pool.connect();
  try {
    const sql = 'SELECT * FROM daily_notes WHERE date BETWEEN $1 AND $2';
    const { rows: notes } = await client.query(sql, [startDate, endDate]);
    return NextResponse.json(notes);
  } catch (error) {
    console.error('Failed to fetch notes:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch notes', details: errorMessage }, { status: 500 });
  } finally {
    client.release();
  }
}

// POST handler to create or update a daily note (upsert)
export async function POST(request: Request) {
  const client = await getDb().connect();
  console.log('NOTES API: Client connected.');
  try {
    await client.query('BEGIN');
    console.log('NOTES API: BEGIN transaction.');
    const { date, note } = await request.json();
    console.log('NOTES API: Received data:', { date, note });

    if (!date) {
      console.log('NOTES API: Date is missing, rolling back.');
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    if (note === null || note.trim() === '') {
      console.log(`NOTES API: Deleting note for date: ${date}`);
      await client.query('DELETE FROM daily_notes WHERE date = $1', [date]);
      console.log('NOTES API: DELETE query executed.');
    } else {
      const sql = `
        INSERT INTO daily_notes (date, note) 
        VALUES ($1, $2) 
        ON CONFLICT (date) 
        DO UPDATE SET note = EXCLUDED.note
      `;
      console.log(`NOTES API: Upserting note for date: ${date}`);
      await client.query(sql, [date, note]);
      console.log('NOTES API: UPSERT query executed.');
    }
    
    await client.query('COMMIT');
    console.log('NOTES API: COMMIT transaction.');
    return NextResponse.json({ message: 'Note saved successfully' }, { status: 200 });

  } catch (error: unknown) {
    console.error('NOTES API: Error occurred, rolling back.', error);
    await client.query('ROLLBACK');
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to save note', details: errorMessage }, { status: 500 });
  } finally {
    client.release();
    console.log('NOTES API: Client released.');
  }
}