'use client';

import { useState, useEffect, FormEvent, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { format, parseISO, startOfToday, addMonths, subMonths } from 'date-fns';

// --- Type Definitions ---
interface ShiftRequest { id: number; date: string; notes: string; request_type: 'holiday' | 'work'; }
interface Employee { id: number; name: string; request_type: 'holiday' | 'work'; }
interface Shift { date: string; }

// --- Helper ---
const getPayPeriodInterval = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const start = new Date(year, month, 11);
    const end = new Date(year, month + 1, 10);
    return { start, end };
};

const getInitialDateForNextPayPeriod = () => {
  const today = new Date();
  if (today.getDate() > 10) {
    today.setMonth(today.getMonth() + 1);
  }
  return today;
};

export default function SubmitRequestPage() {
  const params = useParams();
  const employeeId = params.employeeId as string;

  const [requests, setRequests] = useState<ShiftRequest[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [currentDate, setCurrentDate] = useState(getInitialDateForNextPayPeriod());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const fetchPageData = async () => {
        if (!employeeId) return;
        setIsLoading(true);
        setError(null);
        try {
          const [empRes, reqRes, shiftRes] = await Promise.all([
            fetch(`/api/employees/${employeeId}`),
            fetch(`/api/shift-requests?employeeId=${employeeId}`),
            fetch(`/api/shifts?employeeId=${employeeId}`),
          ]);
          if (!empRes.ok || !reqRes.ok || !shiftRes.ok) throw new Error('データの取得に失敗しました。');
          
          setEmployee(await empRes.json());
          setRequests(await reqRes.json());
          setShifts(await shiftRes.json());

        } catch (err) {
          setError(err instanceof Error ? err.message : '不明なエラーが発生しました。');
        } finally {
          setIsLoading(false);
        }
    };
    if (employeeId) {
      fetchPageData();
    }
  }, [employeeId]);

  const blockedDates = useMemo(() => {
    const dateSet = new Set<string>();
    shifts.forEach(shift => dateSet.add(shift.date));
    requests.forEach(req => dateSet.add(req.date));
    return dateSet;
  }, [shifts, requests]);

  const todayStr = format(startOfToday(), 'yyyy-MM-dd');
  const isDateBlocked = date && (date < todayStr || blockedDates.has(date));
  let dateError = '';
  if (date) {
      if (date < todayStr) {
          dateError = '過去の日付は選択できません。';
      } else if (blockedDates.has(date)) {
          dateError = 'この日は既にシフトまたは希望が登録されています。';
      }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!employeeId || !date || isDateBlocked || !employee?.request_type) return;
    setError(null);
    try {
      const response = await fetch('/api/shift-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: parseInt(employeeId), date, notes, request_type: employee.request_type }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '提出に失敗しました。');
      }
      setDate('');
      setNotes('');
      const reqRes = await fetch(`/api/shift-requests?employeeId=${employeeId}`);
      setRequests(await reqRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : '提出中にエラーが発生しました。');
    }
  };

  const handleDeleteRequest = async (requestId: number) => {
    if (!window.confirm('この希望を取り下げますか？')) return;
    try {
        const response = await fetch(`/api/shift-requests?id=${requestId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('取り下げに失敗しました。');
        const reqRes = await fetch(`/api/shift-requests?employeeId=${employeeId}`);
        setRequests(await reqRes.json());
    } catch (err) { alert(err instanceof Error ? err.message : 'エラーが発生しました。'); }
  };

  const { start, end } = getPayPeriodInterval(currentDate);
  const filteredRequests = requests.filter(r => r.date >= format(start, 'yyyy-MM-dd') && r.date <= format(end, 'yyyy-MM-dd'));

  const pageTitle = employee?.request_type === 'work' ? '希望出勤日の提出' : '希望休の提出';

  if (isLoading) return <p className="p-4 text-center">読み込み中...</p>;
  
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <p className="text-xl mb-6 text-center text-gray-600">{employee?.name} さん</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-2">{pageTitle}</h2>
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
            <div className="mb-4">
              <label htmlFor="date" className="block text-sm font-medium text-gray-700">日付</label>
              <input type="date" id="date" value={date} onChange={(e) => setDate(e.target.value)} min={todayStr} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
              {dateError && <p className="text-red-500 text-sm mt-1">{dateError}</p>}
            </div>
            <div className="mb-4">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">備考 (任意)</label>
              <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
            </div>
            <button type="submit" disabled={!!isDateBlocked || !date} className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400">提出する</button>
            {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
          </form>
        </div>
        <div>
          <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
            <h2 className="text-xl font-semibold">提出済みリスト</h2>
            <div className="flex items-center gap-1">
                <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="px-2 py-1 bg-gray-200 rounded text-sm">前月</button>
                <span className="text-sm font-semibold w-24 text-center">({format(start, 'M/d')}-{format(end, 'M/d')})</span>
                <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="px-2 py-1 bg-gray-200 rounded text-sm">次月</button>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md h-full">
            <ul className="divide-y divide-gray-200">
              {filteredRequests.length > 0 ? filteredRequests.map((req) => (
                <li key={req.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="text-md font-medium">{format(parseISO(req.date), 'yyyy年 M月 d日')} <span className={`text-xs font-bold px-2 py-1 rounded-full ${req.request_type === 'work' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>{req.request_type === 'work' ? '出勤希望' : '休日希望'}</span></p>
                  </div>
                  <button onClick={() => handleDeleteRequest(req.id)} className="text-red-600 hover:text-red-800 text-xs font-semibold">取り下げ</button>
                </li>
              )) : (
                <p className="text-gray-500">この期間に提出された希望はありません。</p>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
  )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
