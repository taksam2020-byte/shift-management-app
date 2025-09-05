import { NextResponse } from 'next/server';
import holiday_jp from '@holiday-jp/holiday_jp';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDateStr = searchParams.get('startDate');
  const endDateStr = searchParams.get('endDate');

  if (!startDateStr || !endDateStr) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
  }

  try {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    // Get holidays between the dates using the library
    const holidays = holiday_jp.between(startDate, endDate);

    return NextResponse.json(holidays);
  } catch (error) {
    console.error('Failed to fetch holidays:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch holidays', details: errorMessage }, { status: 500 });
  }
}