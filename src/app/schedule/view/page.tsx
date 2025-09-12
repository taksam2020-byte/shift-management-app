'use client';

import { useState, useEffect } from 'react';
import { format, eachDayOfInterval, getDay, addMonths, subMonths, parseISO } from 'date-fns';

// Re-using types from other pages
interface Employee { id: number; name: string; }
interface Shift { employee_id: number; date: string; start_time: string; end_time: string; }
interface DailyNote { date: string; note: string; }
interface Holiday { date: Date; name: string; }
type ScheduleState = Record<string, Record<number, string>>;

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

export default function ViewSchedulePage() {
  const [loggedInUserId, setLoggedInUserId] = useState<number | null>(null);
  const [currentDate, setCurrentDate] = useState(getInitialDateForPayPeriod());
  const [days, setDays] = useState<Date[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedule, setSchedule] = useState<ScheduleState>({});
  const [dailyNotes, setDailyNotes] = useState<Record<string, string>>({});
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const storedUser = localStorage.getItem('loggedInUser');
        if (storedUser) {
          setLoggedInUserId(JSON.parse(storedUser).id);
        }
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!loggedInUserId) return;
      setIsLoading(true);
      setError(null);
      const { start, end } = getPayPeriodInterval(currentDate);
      const startDateStr = format(start, 'yyyy-MM-dd');
      const endDateStr = format(end, 'yyyy-MM-dd');
      setDays(eachDayOfInterval({ start, end }));
      try {
        const [empRes, shiftRes, noteRes, holidayRes, companyHolidayRes] = await Promise.all([
          fetch('/api/employees'),
          fetch(`/api/shifts?startDate=${startDateStr}&endDate=${endDateStr}`),
          fetch(`/api/notes?startDate=${startDateStr}&endDate=${endDateStr}`),
          fetch(`/api/holidays?startDate=${startDateStr}&endDate=${endDateStr}`),
          fetch('/api/company-holidays'),
        ]);
        if (!empRes.ok || !shiftRes.ok || !noteRes.ok || !holidayRes.ok || !companyHolidayRes.ok) throw new Error('データの取得に失敗しました。');
        
        const employeesData: Employee[] = await empRes.json();
        const shiftsData: Shift[] = await shiftRes.json();
        const notesData: DailyNote[] = await noteRes.json();
        const nationalHolidays: Holiday[] = (await holidayRes.json()).map((h: { date: string; name: string }) => ({...h, date: parseISO(h.date)}));
        const companyHolidays: Holiday[] = (await companyHolidayRes.json()).map((h: { date: string; note: string }) => ({...h, date: parseISO(h.date), name: h.note || '会社休日'}));

        employeesData.sort((a, b) => {
            if (a.id === loggedInUserId) return -1;
            if (b.id === loggedInUserId) return 1;
            return a.id - b.id;
        });
        setEmployees(employeesData);

        setHolidays([...nationalHolidays, ...companyHolidays].sort((a, b) => a.date.getTime() - b.date.getTime()));

        const newSchedule: ScheduleState = {};
        shiftsData.forEach(shift => {
          if (!shift.date) return;
          const dateStr = shift.date.substring(0, 10); // YYYY-MM-DD形式に整形
          const startTime = shift.start_time ? shift.start_time.substring(0, 5) : null; // HH:MM形式に整形
          const endTime = shift.end_time ? shift.end_time.substring(0, 5) : null; // HH:MM形式に整形

          if (!newSchedule[dateStr]) {
            newSchedule[dateStr] = {};
          }
          newSchedule[dateStr][shift.employee_id] = startTime && endTime ? `${startTime}-${endTime}` : '';
        });
        setSchedule(newSchedule);

        const newNotes: Record<string, string> = {};
        notesData.forEach(note => { newNotes[note.date] = note.note; });
        setDailyNotes(newNotes);

      } catch (err) {
        setError(err instanceof Error ? err.message : '不明なエラーが発生しました。');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [currentDate, loggedInUserId]);

  if (isLoading) return <p className="p-4 text-center">スケジュールを読み込み中...</p>;
  if (error) return <p className="p-4 text-center text-red-500">{error}</p>;

  return (
    <div className="p-4 flex flex-col h-full">
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="px-4 py-2 bg-gray-200 rounded">前月</button>
          <h2 className="text-xl font-semibold">({format(getPayPeriodInterval(currentDate).start, 'M/d')} - {format(getPayPeriodInterval(currentDate).end, 'M/d')})</h2>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="px-4 py-2 bg-gray-200 rounded">次月</button>
        </div>
      </div>
      <div className="flex-grow overflow-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr>
              <th className="border border-gray-300 p-2 w-28 sticky left-0 bg-gray-100">日付</th>
              <th className="border border-gray-300 p-2 w-24">備考</th>
              <th className="border border-gray-300 p-2">人数</th>
              {employees.map((emp) => <th key={emp.id} className="border border-gray-300 p-2 whitespace-nowrap">{emp.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][getDay(day)];
              const holiday = holidays.find(h => format(h.date, 'yyyy-MM-dd') === dateStr);
              const isWeekendOrHoliday = dayOfWeek === '日' || dayOfWeek === '土' || !!holiday;
              const headcount = Object.values(schedule[dateStr] || {}).filter(v => v && v.trim() !== '').length;
              return (
                <tr key={dateStr} className={isWeekendOrHoliday ? 'bg-gray-200' : ''}>
                  <td className={`border border-gray-300 p-2 whitespace-nowrap text-center w-28 sticky left-0 ${isWeekendOrHoliday ? 'font-semibold text-red-600 bg-gray-200' : 'bg-white'}`}>{format(day, 'M/d')} ({dayOfWeek})</td>
                  <td className={`border border-gray-300 w-24 text-center p-1 ${isWeekendOrHoliday ? 'text-red-600' : ''}`}>{dailyNotes[dateStr] || holiday?.name || ''}</td>
                  <td className="border border-gray-300 p-2 text-center">{headcount > 0 ? headcount : ''}</td>
                  {employees.map((emp) => {
                    const cellValue = schedule[dateStr]?.[emp.id] || '';
                    return (
                      <td key={emp.id} className="border border-gray-300 p-2 text-center">
                        {cellValue}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}