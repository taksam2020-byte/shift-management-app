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

    if (closingDay === '31') {
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
    if (d === 31) {
        const periodStart = new Date(year, month - 1, 1);
        const periodEnd = new Date(year, month, 0);
        return { start: periodStart, end: periodEnd };
    }
    const periodEnd = new Date(year, month - 1, d);
    const periodStart = new Date(periodEnd);
    periodStart.setMonth(periodStart.getMonth() - 1);
    periodStart.setDate(periodStart.getDate() + 1);
    return { start: periodStart, end: periodEnd };
};

export default function CrossPeriodReportPage() {
  const [closingDay, setClosingDay] = useState('31');
  const [months, setMonths] = useState(() => getInitialMonths(closingDay));
  const [reportData, setReportData] = useState<CrossPeriodReport | null>(null);
  const [useSchedule, setUseSchedule] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('hours');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMonths(getInitialMonths(closingDay));
  }, [closingDay]);

  useEffect(() => {
    const generateReport = async () => {
        setIsLoading(true);
        setError(null);
        setReportData(null);
        try {
        const params = new URLSearchParams({
            startMonth: months.start,
            endMonth: months.end,
            closingDay,
            useSchedule: String(useSchedule),
            includeInactive: String(showInactive),
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

    generateReport();
  }, [months, closingDay, useSchedule, showInactive]);

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

  const employeeTotals = reportData ? reportData.employees.map(emp => 
    reportData.months.reduce((acc, month) => acc + (reportData.results[displayMode][emp.id]?.[month] || 0), 0)
  ) : [];

  const grandTotal = employeeTotals.reduce((acc, total) => acc + total, 0);

  const today = startOfDay(new Date());

  return (
    <div className="container mx-auto p-4">
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
          <label htmlFor="closingDay" className="block text-sm font-medium text-gray-700" title="集計期間を変更します。20日締めなら毎月21日始まりの集計となります。">締め日 <span className="text-gray-400 cursor-help font-normal">ⓘ</span></label>
          <select id="closingDay" value={closingDay} onChange={(e) => setClosingDay(e.target.value)} className="mt-1 block w-full form-select">
            <option value="31">末締め</option>
            <option value="20">20日締め</option>
          </select>
        </div>
        <div className="flex items-center pt-4 sm:pt-0" title="実績が未入力（打刻漏れ等）の日について、シフトで予定されていた時間を出勤したものとして計算します。">
          <input type="checkbox" id="useSchedule" checked={useSchedule} onChange={(e) => setUseSchedule(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          <label htmlFor="useSchedule" className="ml-2 block text-sm text-gray-900 cursor-pointer">予定で補完 <span className="text-gray-400 cursor-help font-normal">ⓘ</span></label>
        </div>
        <div className="flex items-center pt-4 sm:pt-0" title="過去の集計を確認するために、すでに退職済（非表示）となった従業員のデータも表示します。">
          <input type="checkbox" id="showInactive" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-gray-600 focus:ring-gray-500" />
          <label htmlFor="showInactive" className="ml-2 block text-sm text-gray-600 cursor-pointer">退職者も表示 <span className="text-gray-400 cursor-help font-normal">ⓘ</span></label>
        </div>
        <div className="w-full sm:w-auto">
            <label className="block text-sm font-medium text-gray-700" title="表の中身を勤務時間、勤務日数、概算給与（時給×時間）のいずれかに切り替えます。">表示項目 <span className="text-gray-400 cursor-help font-normal">ⓘ</span></label>
            <select value={displayMode} onChange={(e) => setDisplayMode(e.target.value as DisplayMode)} className="mt-1 block w-full form-select">
                <option value="hours">勤務時間</option>
                <option value="days">勤務日数</option>
                <option value="pay">概算給与</option>
            </select>
        </div>
      </div>

      {error && <p className="text-center text-red-500">{error}</p>}
      {isLoading && <p className="text-center">読み込み中...</p>}
      {reportData && !isLoading && (
        <div className="bg-white rounded-lg shadow-md overflow-x-auto" style={{maxHeight: 'calc(100vh - 250px)'}}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">
              <tr>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-30 w-32 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">月度</th>
                {reportData.employees.map(emp => (
                  <th key={emp.id} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    {emp.name}
                  </th>
                ))}
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase sticky right-0 bg-gray-50 z-30 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">月別合計</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData.months.map(month => {
                const [year, monthNum] = month.split('-');
                const { start, end } = getPeriodDates(month, closingDay);
                const isCurrentMonth = isWithinInterval(today, { start, end });
                
                const monthTotal = reportData.employees.reduce((acc, emp) => acc + (reportData.results[displayMode][emp.id]?.[month] || 0), 0);
                
                return (
                  <tr key={month} className={isCurrentMonth ? 'bg-yellow-50' : ''}>
                    <td className={`px-6 py-4 whitespace-nowrap text-center sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] ${isCurrentMonth ? 'bg-yellow-50' : 'bg-white'}`}>
                      <div className="font-medium text-gray-900">{`${year}年 ${monthNum}月度`}</div>
                    </td>
                    {reportData.employees.map(employee => (
                      <td key={employee.id} className="px-4 py-4 text-center whitespace-nowrap">
                        {formatCell(reportData.results[displayMode][employee.id]?.[month] || 0)}
                      </td>
                    ))}
                    <td className={`px-6 py-4 text-right font-bold sticky right-0 z-10 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)] ${isCurrentMonth ? 'bg-yellow-50' : 'bg-gray-50'}`}>
                      {formatCell(monthTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-100 font-bold sticky bottom-0 z-20 shadow-[-2px_-2px_4px_rgba(0,0,0,0.05)]">
                <tr>
                    <td className="px-6 py-3 text-center sticky left-0 bg-gray-100 z-30 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">年間合計</td>
                    {employeeTotals.map((total, index) => (
                        <td key={index} className="px-4 py-3 text-center whitespace-nowrap">{formatCell(total)}</td>
                    ))}
                    <td className="px-6 py-3 text-right sticky right-0 bg-gray-100 z-30 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)] text-lg">{formatCell(grandTotal)}</td>
                </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}