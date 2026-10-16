import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';
import { checkRole } from '@/lib/auth';
import { ensureNotificationTables } from '@/lib/notify';

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

// 希望休・希望出勤日の締切一覧（ログインしていれば誰でも見られる）
export async function GET(request: Request) {
  const auth = await checkRole(request);
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureNotificationTables();
    const { rows } = await query(
      `SELECT id, to_char(period_start, 'YYYY-MM-DD') AS period_start, to_char(period_end, 'YYYY-MM-DD') AS period_end,
              to_char(deadline, 'YYYY-MM-DD') AS deadline
       FROM request_deadlines ORDER BY period_start DESC`,
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Failed to fetch request deadlines:', error);
    return NextResponse.json({ error: '締切の取得に失敗しました。' }, { status: 500 });
  }
}

// 締切を登録する（管理者のみ）
export async function POST(request: Request) {
  const auth = await checkRole(request, 'admin');
  if (auth instanceof NextResponse) return auth;

  const { period_start, period_end, deadline }: Record<string, unknown> = await request.json().catch(() => ({}));
  if (!isDate(period_start) || !isDate(period_end) || !isDate(deadline)) {
    return NextResponse.json({ error: '対象期間と締切日を入力してください。' }, { status: 400 });
  }
  if (period_start > period_end) {
    return NextResponse.json({ error: '対象期間の開始日が終了日より後になっています。' }, { status: 400 });
  }

  try {
    await ensureNotificationTables();
    const { rows } = await query(
      'INSERT INTO request_deadlines (period_start, period_end, deadline) VALUES ($1, $2, $3) RETURNING id',
      [period_start, period_end, deadline],
    );
    return NextResponse.json({ id: rows[0].id }, { status: 201 });
  } catch (error) {
    console.error('Failed to create request deadline:', error);
    return NextResponse.json({ error: '締切の登録に失敗しました。' }, { status: 500 });
  }
}

// 締切を削除する（管理者のみ）
export async function DELETE(request: Request) {
  const auth = await checkRole(request, 'admin');
  if (auth instanceof NextResponse) return auth;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id が必要です。' }, { status: 400 });

  try {
    await ensureNotificationTables();
    await query('DELETE FROM request_deadlines WHERE id = $1', [id]);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete request deadline:', error);
    return NextResponse.json({ error: '締切の削除に失敗しました。' }, { status: 500 });
  }
}
