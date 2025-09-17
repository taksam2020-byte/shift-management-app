'use client';

import { useState } from 'react';

// --- Type Definitions ---
interface CrossPeriodReport {
  employees: { id: number; name: string; }[];
  months: string[]; // e.g., "2024-08"
  results: Record<number, Record<string, number>>; // { employeeId: { "2024-08": totalHours, ... } }
}

const getInitialMonths = () => {
    const today = new Date();
    const endMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startMonth = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    return {
        start: startMonth.toISOString().substring(0, 7), // YYYY-MM
        end: endMonth.toISOString().substring(0, 7),
    };
};

export default function CrossPeriodReportPage() {
  const [reportData, setReportData] = useState<CrossPeriodReport | null>(null);
  const [months, setMonths] = useState(getInitialMonths);
  const [closingDay, setClosingDay] = useState('10');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    setIsLoading(true);
    setError(null);
    setReportData(null);
    try {
      const params = new URLSearchParams({
        startMonth: months.start,
        endMonth: months.end,
        closingDay,
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

  return (
    <div className="container mx-auto p-4">
      <div className="bg-white p-4 rounded-lg shadow-md mb-6 flex flex-col sm:flex-row items-end gap-4">
        <div className="w-full sm:w-auto">
          <label htmlFor="startMonth" className="block text-sm font-medium text-gray-700">開始月</label>
          <input
            type="month"
            id="startMonth"
            value={months.start}
            onChange={(e) => setMonths(prev => ({ ...prev, start: e.target.value }))}
            className="mt-1 block w-full form-input"
          />
        </div>
        <div className="w-full sm:w-auto">
          <label htmlFor="endMonth" className="block text-sm font-medium text-gray-700">終了月</label>
          <input
            type="month"
            id="endMonth"
            value={months.end}
            onChange={(e) => setMonths(prev => ({ ...prev, end: e.target.value }))}
            className="mt-1 block w-full form-input"
          />
        </div>
        <div className="w-full sm:w-auto">
          <label htmlFor="closingDay" className="block text-sm font-medium text-gray-700">締め日</label>
          <select
            id="closingDay"
            value={closingDay}
            onChange={(e) => setClosingDay(e.target.value)}
            className="mt-1 block w-full form-select"
          >
            <option value="10">10日締め</option>
            <option value="20">20日締め</option>
          </select>
        </div>
        <button
          onClick={handleGenerateReport}
          disabled={isLoading}
          className="w-full sm:w-auto bg-blue-500 text-white py-2 px-6 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
        >
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
                {reportData.months.map(month => (
                  <th key={month} className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{month.replace('-', '年')}月度</th>
                ))}
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">合計</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData.employees.map(employee => {
                const totalHours = reportData.months.reduce((acc, month) => acc + (reportData.results[employee.id]?.[month] || 0), 0);
                return (
                  <tr key={employee.id}>
                    <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-white">{employee.name}</td>
                    {reportData.months.map(month => (
                      <td key={month} className="px-6 py-4 text-right">{(reportData.results[employee.id]?.[month] || 0).toFixed(2)}</td>
                    ))}
                    <td className="px-6 py-4 text-right font-bold">{totalHours.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
