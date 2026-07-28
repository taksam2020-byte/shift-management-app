import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';

export async function POST(request: Request) {
  try {
    const { shiftIds } = await request.json();

    if (!Array.isArray(shiftIds) || shiftIds.length === 0) {
      return NextResponse.json({ error: 'No shift IDs provided' }, { status: 400 });
    }

    // まず、万が一実績が存在しているシフトが含まれていた場合の安全策として、
    // 対象シフトに紐づくactual_work_hoursがあれば削除する（通常はないはずだが整合性のため）
    const params = shiftIds.map((_, i) => `$${i + 1}`).join(',');
    
    await query(`DELETE FROM actual_work_hours WHERE shift_id IN (${params})`, shiftIds);
    await query(`DELETE FROM shifts WHERE id IN (${params})`, shiftIds);

    return NextResponse.json({ success: true, count: shiftIds.length });
  } catch (error) {
    console.error('Failed to bulk delete shifts:', error);
    return NextResponse.json({ error: 'Failed to bulk delete shifts' }, { status: 500 });
  }
}
