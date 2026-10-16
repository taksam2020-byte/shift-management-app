import { NextResponse } from 'next/server';
import { checkRole } from '@/lib/auth';
import { fetchIncomeByEmployee } from '@/lib/income';

// 期間中の従業員ごとの収入合計（実績があれば実績、なければ予定で見込み計算）
export async function GET(request: Request) {
  const auth = await checkRole(request, 'admin');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
  }

  try {
    const incomeByEmployee = await fetchIncomeByEmployee(startDate, endDate);

    const formattedResult = Object.entries(incomeByEmployee).map(([employee_id, total_income]) => ({
      employee_id: parseInt(employee_id, 10),
      total_income,
    }));

    return NextResponse.json(formattedResult);

  } catch (error) {
    console.error('Failed to fetch annual summary:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch annual summary', details: errorMessage }, { status: 500 });
  }
}
