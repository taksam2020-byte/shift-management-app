import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs'; // トランザクションのため、プールを取得

// POST handler to create or update multiple daily notes (upsert)
export async function POST(request: Request) {
  const pool = getDb();
  const client = await pool.connect(); // プールからクライアントを一つ取得

  try {
    const notesToSave: { date: string; note: string }[] = await request.json();

    if (!Array.isArray(notesToSave)) {
        return NextResponse.json({ error: 'Expected an array of note objects' }, { status: 400 });
    }

    await client.query('BEGIN'); // トランザクション開始

    try {
        const sql = `
            INSERT INTO daily_notes (date, note) 
            VALUES ($1, $2) 
            ON CONFLICT (date) 
            DO UPDATE SET note = EXCLUDED.note
        `;
        for (const item of notesToSave) {
            await client.query(sql, [item.date, item.note]);
        }
        await client.query('COMMIT'); // トランザクションをコミット
        return NextResponse.json({ message: 'Notes saved successfully' }, { status: 200 });
    } catch (innerError) {
        await client.query('ROLLBACK'); // エラー発生時はロールバック
        throw innerError; // エラーを再スローして外側のcatchで処理
    }

  } catch (error) {
    console.error('Failed to save notes in batch:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to save notes', details: errorMessage }, { status: 500 });
  } finally {
    client.release(); // 最後に必ずクライアントをプールに返却
  }
}