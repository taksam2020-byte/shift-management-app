'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  name: string;
}

interface CrossPeriodReport {
  employees: { id: number; name: string; }[];
  months: string[];
  results: {
    hours: Record<number, Record<string, number>>;
    days: Record<number, Record<string, number>>;
    pay: Record<number, Record<string, number>>;
  };
}

const getInitialMonths = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    return {
        start: ${currentYear}-01,
        end: ${currentYear}-12
    };
};

export default function EmployeeReportPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [closingDay, setClosingDay] = useState('31');
  const [months, setMonths] = useState(getInitialMonths());
  const [reportData, setReportData] = useState<CrossPeriodReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      router.push('/employee/login');
    }
  }, [router]);

  useEffect(() => {
    if (!user) return;
    
    const generateReport = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                startMonth: months.start,
                endMonth: months.end,
                closingDay,
                useSchedule: 'false',
                includeInactive: 'true',
            });
            const response = await fetch(/api/reports/cross-period?${params.toString()});
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
  }, [user, months, closingDay]);

  if (!user) return <div className="p-4">読み込み中...</div>;

  return (
    <div className="container mx-auto p-4 max-w-lg">
      <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
        マイレポート
      </h1>

      <div className="bg-white p-4 rounded-lg shadow-md mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">開始月</label>
          <input type="month" value={months.start} onChange={(e) => setMonths(prev => ({ ...prev, start: e.target.value }))} className="block w-full form-input rounded-md border-gray-300" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">終了月</label>
          <input type="month" value={months.end} onChange={(e) => setMonths(prev => ({ ...prev, end: e.target.value }))} className="block w-full form-input rounded-md border-gray-300" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">締め日</label>
          <select value={closingDay} onChange={(e) => setClosingDay(e.target.value)} className="block w-full form-select rounded-md border-gray-300">
            <option value="31">末締め</option>
            <option value="20">20日締め</option>
          </select>
        </div>
      </div>

      {error && <p className="text-center text-red-500 mb-4">{error}</p>}
      {isLoading && <p className="text-center text-gray-600 mb-4">データを取得中...</p>}

      {!isLoading && reportData && (
        <div className="space-y-4">
          {reportData.months.slice().reverse().map(month => {
            const [year, monthNum] = month.split('-');
            const hours = reportData.results.hours[user.id]?.[month] || 0;
            const days = reportData.results.days[user.id]?.[month] || 0;

            return (
              <div key={month} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-green-50 px-4 py-3 border-b border-green-100 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-green-800">{year}年 {monthNum}月度</h2>
                </div>
                <div className="p-4 grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-md border border-gray-100">
                        <div className="text-xs text-gray-500 mb-1">勤務時間</div>
                        <div className="text-xl font-bold text-gray-800">{hours.toFixed(2)}<span className="text-sm font-normal text-gray-600 ml-1">h</span></div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-md border border-gray-100">
                        <div className="text-xs text-gray-500 mb-1">勤務日数</div>
                        <div className="text-xl font-bold text-gray-800">{days}<span className="text-sm font-normal text-gray-600 ml-1">日</span></div>
                    </div>
                </div>
              </div>
            );
          })}

          {reportData.months.length === 0 && (
             <p className="text-center text-gray-500">対象期間のデータがありません。</p>
          )}
        </div>
      )}
    </div>
  );
}
