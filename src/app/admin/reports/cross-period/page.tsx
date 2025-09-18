'use client';

import { useState, useEffect } from 'react';
import { format, isWithinInterval, startOfDay } from 'date-fns';

// --- Type Definitions ---
type DisplayMode = 'hours' | 'days' | 'pay';

interface CrossPeriodReport {
  employees: { id: number; name: string; }[];
  months: string[]; // e.g., "2024-08"
  results: Record<DisplayMode, Record<number, Record<string, number>>>;
}

const getInitialMonths = (closingDay: string) => {
    const today = new Date();
    const currentYear = today.getFullYear();
    let start, end;

    if (closingDay === '10') {
        start = `${currentYear}-01`;
        end = `${currentYear}-12`;
    } else { // 20日締め
        start = `${currentYear}-02`;
        end = `${currentYear + 1}-01`;
    }
    return { start, end };
};

const getPeriodDates = (monthStr: string, closingDay: string) => {
    if (!monthStr) return { start: new Date(), end: new Date() };
    const [year, month] = monthStr.split('-').map(Number);
    const d = parseInt(closingDay, 10);
    const periodEnd = new Date(year, month - 1, d);
    const periodStart = new Date(periodEnd);
    periodStart.setMonth(periodStart.getMonth() - 1);
    periodStart.setDate(periodStart.getDate() + 1);
    return { start: periodStart, end: periodEnd };
};

export default function CrossPeriodReportPage() {
  const [closingDay, setClosingDay] = useState('10');
  const [months, setMonths] = useState(() => getInitialMonths(closingDay));
  const [reportData, setReportData] = useState<CrossPeriodReport | null>(null);
  const [useSchedule, setUseSchedule] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('hours');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMonths(getInitialMonths(closingDay));
  }, [closingDay]);

  const handleGenerateReport = async () => {
    setIsLoading(true);
    setError(null);
    setReportData(null);
    try {
      const params = new URLSearchParams({
        startMonth: months.start,
        endMonth: months.end,
        closingDay,
        useSchedule: String(useSchedule),
      });
      const response = await fetch(`/api/reports/cross-period?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'レポートの生成に失敗しました。');
      }
      const data: CrossPeriodReport = await response.json();
      setReportData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const { start: startDate, end: _ } = getPeriodDates(months.start, closingDay);
  const { start: __, end: finalEndDate } = getPeriodDates(months.end, closingDay);

  const formatCell = (value: number) => {
    switch (displayMode) {
        case 'pay': return `¥${Math.round(value).toLocaleString()}`;
        case 'hours': return value.toFixed(2);
        case 'days': return value;
        default: return value;
    }
  };

  const columnTotals = reportData ? reportData.months.map(month => 
    reportData.employees.reduce((acc, emp) => acc + (reportData.results[displayMode][emp.id]?.[month] || 0), 0)
  ) : [];

  const grandTotal = columnTotals.reduce((acc, total) => acc + total, 0);

  const today = startOfDay(new Date());

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">年間集計</h1>
      <div className="bg-white p-4 rounded-lg shadow-md mb-6 flex flex-wrap items-end gap-4">
        {/* ... control inputs ... */}
        <div className="w-full sm:w-auto">
          <label htmlFor="startMonth" className="block text-sm font-medium text-gray-700">開始月</label>
          <input type="month" id="startMonth" value={months.start} onChange={(e) => setMonths(prev => ({ ...prev, start: e.target.value }))} className="mt-1 block w-full form-input" />
          <p className="text-xs text-gray-500 mt-1">{format(startDate, 'yyyy/M/d')} ~</p>
        </div>
        <div className="w-full sm:w-auto">
          <label htmlFor="endMonth" className="block text-sm font-medium text-gray-700">終了月</label>
          <input type="month" id="endMonth" value={months.end} onChange={(e) => setMonths(prev => ({ ...prev, end: e.target.value }))} className="mt-1 block w-full form-input" />
          <p className="text-xs text-gray-500 mt-1">~ {format(finalEndDate, 'yyyy/M/d')}</p>
        </div>
        <div className="w-full sm:w-auto">
          <label htmlFor="closingDay" className="block text-sm font-medium text-gray-700">締め日</label>
          <select id="closingDay" value={closingDay} onChange={(e) => setClosingDay(e.target.value)} className="mt-1 block w-full form-select">
            <option value="10">10日締め</option>
            <option value="20">20日締め</option>
          </select>
        </div>
        <div className="flex items-center pt-4 sm:pt-0">
          <input type="checkbox" id="useSchedule" checked={useSchedule} onChange={(e) => setUseSchedule(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          <label htmlFor="useSchedule" className="ml-2 block text-sm text-gray-900">未入力の実績をシフト予定で補完</label>
        </div>
        <div className="w-full sm:w-auto">
            <label className="block text-sm font-medium text-gray-700">表示項目</label>
            <select value={displayMode} onChange={(e) => setDisplayMode(e.target.value as DisplayMode)} className="mt-1 block w-full form-select">
                <option value="hours">勤務時間</option>
                <option value="days">勤務日数</option>
                <option value="pay">概算給与</option>
            </select>
        </div>
        <button onClick={handleGenerateReport} disabled={isLoading} className="w-full sm:w-auto bg-blue-500 text-white py-2 px-6 rounded-md hover:bg-blue-600 disabled:bg-gray-400 self-end">
          {isLoading ? '生成中...' : 'レポート生成'}
        </button>
      </div>

      {error && <p className="text-center text-red-500">{error}</p>}
      {reportData && (
        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10">従業員</th>
                {reportData.months.map(month => {
                  const [year, monthNum] = month.split('-');
                  const { start, end } = getPeriodDates(month, closingDay);
                  const isCurrentMonth = isWithinInterval(today, { start, end });
                  return (
                    <th key={month} className={`px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-pre-line ${isCurrentMonth ? 'bg-yellow-100' : ''}`}>{`${year}年
${monthNum}月度`}</th>
                  )
                })}
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">合計</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData.employees.map(employee => {
                const totalValue = reportData.months.reduce((acc, month) => acc + (reportData.results[displayMode][employee.id]?.[month] || 0), 0);
                return (
                  <tr key={employee.id}>
                    <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-white">{employee.name}</td>
                    {reportData.months.map(month => {
                      const { start, end } = getPeriodDates(month, closingDay);
                      const isCurrentMonth = isWithinInterval(today, { start, end });
                      return (
                        <td key={month} className={`px-6 py-4 text-right ${isCurrentMonth ? 'bg-yellow-50' : ''}`}>{formatCell(reportData.results[displayMode][employee.id]?.[month] || 0)}</td>
                      )
                    })}
                    <td className="px-6 py-4 text-right font-bold">{formatCell(totalValue)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-100 font-bold">
                <tr>
                    <td className="px-6 py-3 text-left sticky left-0 bg-gray-100">合計</td>
                    {columnTotals.map((total, index) => {
                        const month = reportData.months[index];
                        const { start, end } = getPeriodDates(month, closingDay);
                        const isCurrentMonth = isWithinInterval(today, { start, end });
                        return (
                            <td key={index} className={`px-6 py-3 text-right ${isCurrentMonth ? 'bg-yellow-100' : ''}`}>{formatCell(total)}
                            </td>
                        )
                    })}
                    <td className="px-6 py-3 text-right">{formatCell(grandTotal)}</td>
                </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
