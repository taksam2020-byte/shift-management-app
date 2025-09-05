import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';

// POST handler to create or update multiple daily notes (upsert)
export async function POST(request: Request) {
  try {
    const notesToSave: { date: string; note: string }[] = await request.json();

    if (!Array.isArray(notesToSave)) {
        return NextResponse.json({ error: 'Expected an array of note objects' }, { status: 400 });
    }

    const db = await getDb();
    await db.run('BEGIN TRANSACTION');

    try {
        const stmt = await db.prepare('INSERT OR REPLACE INTO daily_notes (date, note) VALUES (?, ?)');
        for (const item of notesToSave) {
            await stmt.run(item.date, item.note);
        }
        await stmt.finalize();
        await db.run('COMMIT');
        return NextResponse.json({ message: 'Notes saved successfully' }, { status: 200 });
    } catch (innerError) {
        await db.run('ROLLBACK');
        throw innerError;
    }

  } catch (error) {
    console.error('Failed to save notes in batch:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to save notes', details: errorMessage }, { status: 500 });
  }
}
