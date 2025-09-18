'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';

// --- Type Definitions ---
interface ReportRow {
  employee_name: string;
  total_days: number;
  total_hours: number;
  total_pay: number;
}

// --- Helper ---
const getDefaultDateRange = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const start = new Date(year, month, 11);
    if (today.getDate() < 11) {
        start.setMonth(start.getMonth() - 1);
    }
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 10);
    
    return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
    };
};

export default function MonthlyReportPage() {
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [dateRange, setDateRange] = useState(getDefaultDateRange);
  const [useSchedule, setUseSchedule] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generateReport = async () => {
        if (!dateRange.startDate || !dateRange.endDate) return;

        setIsLoading(true);
        setError(null);
        setReportData([]);

        try {
        const params = new URLSearchParams({
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            useSchedule: String(useSchedule),
        });
        const response = await fetch(`/api/reports/monthly?${params.toString()}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'レポートの生成に失敗しました。');
        }
        const data = await response.json();
        setReportData(data);
        } catch (err) {
        setError(err instanceof Error ? err.message : '不明なエラーが発生しました。');
        } finally {
        setIsLoading(false);
        }
    };

    generateReport();
  }, [dateRange, useSchedule]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateRange(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const totals = reportData.reduce((acc, row) => ({
    total_days: acc.total_days + row.total_days,
    total_hours: acc.total_hours + row.total_hours,
    total_pay: acc.total_pay + row.total_pay,
  }), { total_days: 0, total_hours: 0, total_pay: 0 });

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">月間集計</h1>
      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6 flex flex-wrap items-end gap-4 justify-between">
        <div className="w-full sm:w-auto">
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">開始日</label>
          <input
            type="date"
            id="startDate"
            name="startDate"
            value={dateRange.startDate}
            onChange={handleDateChange}
            className="mt-1 block w-full form-input"
          />
        </div>
        <div className="w-full sm:w-auto">
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">終了日</label>
          <input
            type="date"
            id="endDate"
            name="endDate"
            value={dateRange.endDate}
            onChange={handleDateChange}
            className="mt-1 block w-full form-input"
          />
        </div>
        <div className="flex items-center pt-4 sm:pt-0">
          <input
            type="checkbox"
            id="useSchedule"
            checked={useSchedule}
            onChange={(e) => setUseSchedule(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="useSchedule" className="ml-2 block text-sm text-gray-900">
            未入力の実績をシフト予定で補完する
          </label>
        </div>
      </div>

      {/* Report Table */}
      {error && <p className="text-center text-red-500">{error}</p>}
      {isLoading && <p className="text-center">読み込み中...</p>}
      {!isLoading && (
        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
                <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">従業員</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">出勤日数</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">合計時間</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">概算給与</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {reportData.length > 0 ? (
                reportData.map((row, index) => (
                    <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">{row.employee_name}</td>
                    <td className="px-6 py-4 text-right">{row.total_days} 日</td>
                    <td className="px-6 py-4 text-right">{row.total_hours.toFixed(2)} 時間</td>
                    <td className="px-6 py-4 text-right">¥{Math.round(row.total_pay).toLocaleString()}</td>
                    </tr>
                ))
                ) : (
                <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                    {isLoading ? '...' : 'データがありません。'} 
                    </td>
                </tr>
                )}
            </tbody>
            {reportData.length > 0 && (
                <tfoot className="bg-gray-100 font-bold">
                <tr>
                    <td className="px-6 py-3 text-left">合計</td>
                    <td className="px-6 py-3 text-right">{totals.total_days} 日</td>
                    <td className="px-6 py-3 text-right">{totals.total_hours.toFixed(2)} 時間</td>
                    <td className="px-6 py-3 text-right">¥{Math.round(totals.total_pay).toLocaleString()}</td>
                </tr>
                </tfoot>
            )}
            </table>
        </div>
      )}
    </div>
  );
}
