import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';

// GET all company holidays
export async function GET() {
  try {
    const db = await getDb();
    const holidays = await db.all('SELECT * FROM company_holidays ORDER BY date');
    return NextResponse.json(holidays);
  } catch (error) {
    console.error('Failed to fetch company holidays:', error);
    return NextResponse.json({ error: 'Failed to fetch company holidays' }, { status: 500 });
  }
}

// POST a new company holiday
export async function POST(request: Request) {
  try {
    const { date, note } = await request.json();
    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }
    const db = await getDb();
    await db.run(
      'INSERT OR REPLACE INTO company_holidays (date, note) VALUES (?, ?)',
      [date, note || '']
    );
    return NextResponse.json({ message: 'Company holiday saved' }, { status: 201 });
  } catch (error) {
    console.error('Failed to save company holiday:', error);
    return NextResponse.json({ error: 'Failed to save company holiday' }, { status: 500 });
  }
}

// DELETE a company holiday
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  if (!date) {
    return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 });
  }

  try {
    const db = await getDb();
    const result = await db.run('DELETE FROM company_holidays WHERE date = ?', [date]);
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Holiday not found' }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete company holiday:', error);
    return NextResponse.json({ error: 'Failed to delete company holiday' }, { status: 500 });
  }
}
