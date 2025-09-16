'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { format, parseISO, isPast, getDay, addMonths, subMonths } from 'date-fns';
import ActualsInput from '@/components/ActualsInput';

// --- Type Definitions ---
interface Shift {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  actual_id?: number | null;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
  break_hours?: number | null;
}
interface Employee { id: number; name: string; }

// --- Helper ---
const getPayPeriodInterval = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const start = new Date(year, month, 11);
    const end = new Date(year, month + 1, 10);
    return { start, end };
};

const getInitialDateForPayPeriod = () => {
  const today = new Date();
  if (today.getDate() <= 10) {
    today.setMonth(today.getMonth() - 1);
  }
  return today;
};

const calculateDuration = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    if (isNaN(startHour) || isNaN(endHour) || isNaN(startMinute) || isNaN(endMinute)) return 0;
    const duration = (endHour + endMinute / 60) - (startHour + startMinute / 60);
    return duration > 0 ? duration : 0;
};

// --- Sub-component for a single shift row ---
function ShiftRow({ shift, onSave }: { shift: Shift, onSave: (shiftId: number, start: string, end: string, breakHours: number) => Promise<void> }) {
    const [actualStart, setActualStart] = useState(shift.actual_start_time || shift.start_time);
    const [actualEnd, setActualEnd] = useState(shift.actual_end_time || shift.end_time);
    const [breakHours, setBreakHours] = useState(shift.break_hours ?? 1);
    
    const canEdit = isPast(parseISO(shift.date));
    const isSaved = !!shift.actual_id;
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][getDay(parseISO(shift.date))];

    const workDuration = calculateDuration(actualStart, actualEnd) - breakHours;

    const handleTimeChange = (part: 'start' | 'end', newTime: string) => {
        if (part === 'start') {
            setActualStart(newTime);
        } else {
            setActualEnd(newTime);
        }
    };

    const handleSave = (e: FormEvent) => {
        e.preventDefault();
        onSave(shift.id, actualStart, actualEnd, breakHours);
    };

    return (
        <li className={`p-4 bg-white rounded-lg shadow-md ${isSaved ? 'bg-green-50' : ''}`}>
            <div className="flex justify-between items-center w-full mb-3">
                <p className="text-lg font-bold">{format(parseISO(shift.date), 'M月d日')} ({dayOfWeek})</p>
                <p className="text-sm text-gray-600">予定: {shift.start_time} - {shift.end_time}</p>
            </div>
            <form onSubmit={handleSave} className="flex flex-wrap justify-center items-end gap-4 w-full">
                <ActualsInput 
                    startTime={actualStart}
                    endTime={actualEnd}
                    canEdit={canEdit}
                    onTimeChange={handleTimeChange}
                />
                <div className="text-center">
                    <label className="block text-xs font-medium text-gray-700">休憩(h)</label>
                    <input 
                        type="number"
                        step="0.25"
                        value={breakHours}
                        onChange={(e) => setBreakHours(parseFloat(e.target.value) || 0)}
                        className="form-input w-20 text-center"
                        disabled={!canEdit}
                    />
                </div>
                <div className="text-center">
                    <p className="text-xs font-medium text-gray-700">勤務時間</p>
                    <p className="font-bold text-lg">{workDuration > 0 ? workDuration.toFixed(2) : '0.00'} h</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                    <button type="submit" className="bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 disabled:bg-gray-300" disabled={!canEdit}>
                        保存
                    </button>
                    {isSaved && <span className="text-xs text-green-700 font-bold">保存済</span>}
                </div>
            </form>
        </li>
    );
}

export default function MySchedulePage() {
  const params = useParams();
  const employeeId = params.employeeId as string;

  const [currentDate, setCurrentDate] = useState(getInitialDateForPayPeriod());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchMySchedule = async () => {
        if (!employeeId) return;
        setIsLoading(true);
        setError(null);

        try {
            const empResponse = await fetch(`/api/employees/${employeeId}`);
            if (!empResponse.ok) throw new Error('従業員情報の取得に失敗しました。');
            const empData = await empResponse.json();
            setEmployee(empData);

            const { start, end } = getPayPeriodInterval(currentDate);
            const startDateStr = format(start, 'yyyy-MM-dd');
            const endDateStr = format(end, 'yyyy-MM-dd');

            const shiftResponse = await fetch(`/api/shifts?employeeId=${employeeId}&startDate=${startDateStr}&endDate=${endDateStr}`);
            if (!shiftResponse.ok) throw new Error('シフトの取得に失敗しました。');
            const shiftData: Shift[] = await shiftResponse.json();

            const sortedShifts = shiftData.sort((a, b) => {
                const aIsSaved = !!a.actual_id;
                const bIsSaved = !!b.actual_id;
                if (aIsSaved !== bIsSaved) {
                    return aIsSaved ? 1 : -1;
                }
                return new Date(a.date).getTime() - new Date(b.date).getTime();
            });

            setShifts(sortedShifts);

        } catch (err) {
            setError(err instanceof Error ? err.message : '不明なエラーが発生しました。');
        } finally {
            setIsLoading(false);
        }
    };

    if(employeeId) fetchMySchedule();
  }, [employeeId, currentDate]);

  const handleSaveActuals = async (shiftId: number, actual_start_time: string, actual_end_time: string, break_hours: number) => {
    try {
        const response = await fetch('/api/actuals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shift_id: shiftId, actual_start_time, actual_end_time, break_hours }),
        });
        if (!response.ok) throw new Error('実績の保存に失敗しました。');
        alert('勤務実績を保存しました。');
        // Re-fetch data to update saved status and sort order
        const { start, end } = getPayPeriodInterval(currentDate);
        const startDateStr = format(start, 'yyyy-MM-dd');
        const endDateStr = format(end, 'yyyy-MM-dd');
        const shiftResponse = await fetch(`/api/shifts?employeeId=${employeeId}&startDate=${startDateStr}&endDate=${endDateStr}`);
        const shiftData: Shift[] = await shiftResponse.json();
        const sortedShifts = shiftData.sort((a, b) => {
            const aIsSaved = !!a.actual_id;
            const bIsSaved = !!b.actual_id;
            if (aIsSaved !== bIsSaved) { return aIsSaved ? 1 : -1; }
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        });
        setShifts(sortedShifts);
    } catch (err) {
        alert(err instanceof Error ? err.message : 'エラーが発生しました。');
    }
  };

  if (isLoading) return <p className="p-4 text-center">読み込み中...</p>;
  if (error) return <p className="p-4 text-center text-red-500">{error}</p>;

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <p className="text-xl mb-6 text-center text-gray-600">{employee?.name} さん</p>

      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="px-4 py-2 bg-gray-200 rounded">前月</button>
        <h2 className="text-xl font-semibold">{format(getPayPeriodInterval(currentDate).start, 'M/d')} - {format(getPayPeriodInterval(currentDate).end, 'M/d')}</h2>
        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="px-4 py-2 bg-gray-200 rounded">次月</button>
      </div>

      <ul className="space-y-4">
        {shifts.length > 0 ? (
            shifts.map(shift => <ShiftRow key={shift.id} shift={shift} onSave={handleSaveActuals} />)
        ) : (
            <p className="text-center bg-white p-6 rounded-lg shadow-md">この期間のシフトはありません。</p>
        )}
      </ul>
    </div>
  );
}