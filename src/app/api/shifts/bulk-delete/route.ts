import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { checkRole } from '@/lib/auth';

export async function POST(request: Request) {
  const auth = await checkRole(request, 'admin');
  if (auth instanceof NextResponse) return auth;

  const client = await getDb().connect();
  try {
    const { shiftIds } = await request.json();

    if (!Array.isArray(shiftIds) || shiftIds.length === 0) {
      return NextResponse.json({ error: 'No shift IDs provided' }, { status: 400 });
    }

    // 万が一実績が存在しているシフトが含まれていた場合の安全策として、
    // 対象シフトに紐づくactual_work_hoursがあれば削除する（通常はないはずだが整合性のため）
    await client.query('BEGIN');
    await client.query('DELETE FROM actual_work_hours WHERE shift_id = ANY($1::int[])', [shiftIds]);
    const result = await client.query('DELETE FROM shifts WHERE id = ANY($1::int[])', [shiftIds]);
    await client.query('COMMIT');

    return NextResponse.json({ success: true, count: result.rowCount });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Failed to bulk delete shifts:', error);
    return NextResponse.json({ error: 'Failed to bulk delete shifts' }, { status: 500 });
  } finally {
    client.release();
  }
}
