'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { format, parseISO, startOfToday, addMonths, subMonths, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

// --- Type Definitions ---
interface ShiftRequest { id: number; date: string; request_type: 'holiday' | 'work'; }
interface Employee { id: number; name: string; request_type: 'holiday' | 'work'; }
interface Shift { date: string; }

export default function RequestShiftPage() {
  const params = useParams();
  const employeeId = params.employeeId as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [existingRequests, setExistingRequests] = useState<ShiftRequest[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDays, setSelectedDays] = useState<Date[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          const reqData: ShiftRequest[] = await reqRes.json();
          setExistingRequests(reqData);
          setShifts(await shiftRes.json());
          // Initialize selected days with existing requests
          const initialDays = reqData.map(r => parseISO(r.date));
          setSelectedDays(initialDays);

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

  // Warn on unsaved changes
  useEffect(() => {
    const originalDatesStr = JSON.stringify(existingRequests.map(r => r.date).sort());
    const selectedDatesStr = JSON.stringify(selectedDays.map(d => format(d, 'yyyy-MM-dd')).sort());
    
    if (originalDatesStr !== selectedDatesStr) {
      setIsDirty(true);
    } else {
      setIsDirty(false);
    }
  }, [selectedDays, existingRequests]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = ''; // Required for legacy browsers
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  const blockedDates = useMemo(() => {
    return shifts.map(s => parseISO(s.date.substring(0, 10)));
  }, [shifts]);

  const handleDayClick = (day: Date) => {
    // Ignore past dates and blocked dates
    if (day < startOfToday() || blockedDates.some(d => isSameDay(d, day))) {
      return;
    }
    
    const isSelected = selectedDays.some(d => isSameDay(d, day));
    if (isSelected) {
      setSelectedDays(selectedDays.filter(d => !isSameDay(d, day)));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSubmit = async () => {
    if (!employeeId || !employee) return;
    setIsSubmitting(true);
    setError(null);

    const originalDates = new Set(existingRequests.map(r => r.date.substring(0, 10)));
    const selectedDates = new Set(selectedDays.map(d => format(d, 'yyyy-MM-dd')));

    const toAdd = [...selectedDates].filter(d => !originalDates.has(d));
    const toDelete = [...originalDates].filter(d => !selectedDates.has(d));
    
    try {
      const addPromises = toAdd.map(date => 
        fetch('/api/shift-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id: parseInt(employeeId), date, request_type: employee.request_type }),
        }).then(res => { if (!res.ok) throw new Error('追加に失敗'); })
      );

      const deletePromises = toDelete.map(date => {
        const requestId = existingRequests.find(r => r.date.substring(0, 10) === date)?.id;
        if (!requestId) return Promise.resolve();
        return fetch(`/api/shift-requests?id=${requestId}`, { method: 'DELETE' })
          .then(res => { if (!res.ok) throw new Error('削除に失敗'); });
      });

      await Promise.all([...addPromises, ...deletePromises]);

      // Refetch requests to update the state
      const reqRes = await fetch(`/api/shift-requests?employeeId=${employeeId}`);
      const reqData = await reqRes.json();
      setExistingRequests(reqData);
      setSelectedDays(reqData.map((r: ShiftRequest) => parseISO(r.date)));
      setIsDirty(false); // Reset dirty state after successful submission
      alert('希望を更新しました。');

    } catch (err) {
      setError(err instanceof Error ? err.message : '更新中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pageTitle = employee?.request_type === 'work' ? '希望出勤日の提出' : '希望休の提出';
  const payPeriod = useMemo(() => {
    const d = 10; // 10日締め
    let refDate = new Date(currentMonth);
    if (refDate.getDate() <= d) {
        refDate = subMonths(refDate, 1);
    }
    const start = new Date(refDate.getFullYear(), refDate.getMonth(), d + 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, d);
    return { start, end };
  }, [currentMonth]);

  if (isLoading) return <p className="p-4 text-center">読み込み中...</p>;
  if (error) return <p className="p-4 text-center text-red-500">{error}</p>;

  return (
    <div className="container mx-auto p-4 max-w-lg">
      <div className="text-center mb-6">
        <p className="text-xl text-gray-600">{employee?.name} さん</p>
        <h1 className="text-2xl font-bold">{pageTitle}</h1>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="px-3 py-1 bg-gray-200 rounded-md text-sm">前月</button>
            <div className="text-center">
                <h2 className="font-semibold">{format(currentMonth, 'yyyy年 M月')}</h2>
                <p className="text-xs text-gray-500">({format(payPeriod.start, 'M/d')} ~ {format(payPeriod.end, 'M/d')})</p>
            </div>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="px-3 py-1 bg-gray-200 rounded-md text-sm">次月</button>
        </div>

        <div className="flex justify-center">
          <DayPicker
            locale={ja}
            mode="multiple"
            min={0}
            selected={selectedDays}
            onDayClick={handleDayClick}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            disabled={[...blockedDates, { before: startOfToday() }]}
            modifiers={{
              blocked: blockedDates,
            }}
            modifiersClassNames={{
              selected: 'bg-blue-500 text-white',
              today: 'font-bold',
              blocked: 'text-gray-400 cursor-not-allowed',
            }}
            showOutsideDays
            fixedWeeks
          />
        </div>
        <div className="text-xs text-gray-500 mt-2 p-2 border-t">
            <p><span className="inline-block w-3 h-3 bg-blue-500 mr-2"></span>希望日</p>
            <p><span className="inline-block w-3 h-3 bg-gray-200 mr-2"></span>シフト確定/過去の日</p>
        </div>

        <button 
          onClick={handleSubmit} 
          disabled={isSubmitting}
          className="w-full mt-4 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
        >
          {isSubmitting ? '更新中...' : 'この内容で希望を提出する'}
        </button>
      </div>
    </div>
  );
}