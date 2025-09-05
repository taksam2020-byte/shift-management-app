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

  try {
    const db = await getDb();
    const notes = await db.all(
      'SELECT * FROM daily_notes WHERE date BETWEEN ? AND ?',
      [startDate, endDate]
    );
    return NextResponse.json(notes);
  } catch (error) {
    console.error('Failed to fetch notes:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch notes', details: errorMessage }, { status: 500 });
  }
}

// POST handler to create or update a daily note (upsert)
export async function POST(request: Request) {
  try {
    const { date, note } = await request.json();

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    const db = await getDb();
    // Use INSERT OR REPLACE for a simple upsert
    await db.run(
      'INSERT OR REPLACE INTO daily_notes (date, note) VALUES (?, ?)',
      [date, note]
    );

    return NextResponse.json({ message: 'Note saved successfully' }, { status: 200 });

  } catch (error) {
    console.error('Failed to save note:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to save note', details: errorMessage }, { status: 500 });
  }
}
