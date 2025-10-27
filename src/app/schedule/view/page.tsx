'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, eachDayOfInterval, getDay, addMonths, subMonths, parseISO, startOfMonth, endOfMonth, isWithinInterval, startOfWeek, endOfWeek } from 'date-fns';
import { ja } from 'date-fns/locale';

// --- Type Definitions ---
type ViewMode = 'table' | 'card' | 'calendar';
interface Employee { id: number; name: string; default_work_hours?: string | null; }
interface Shift { employee_id: number; date: string; start_time: string; end_time: string; }
interface ShiftRequest { employee_id: number; date: string; request_type: 'holiday' | 'work'; }
interface DailyNote { date: string; note: string; }
interface Holiday { date: Date; name: string; type: 'public_holiday' | 'company_holiday'; }
type ScheduleState = Record<string, Record<number, string>>;
interface User { id: number; name: string; isAdmin: boolean; isViewer?: boolean; }

// --- Helper Functions ---
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

const parseShiftTime = (time: string): number => {
    if (!time || !time.includes('-')) return 0;
    const [start, end] = time.split('-');
    const startHour = parseInt(start.split(':')[0], 10);
    const startMinute = parseInt(start.split(':')[1] || '0', 10);
    const endHour = parseInt(end.split(':')[0], 10);
    const endMinute = parseInt(end.split(':')[1] || '0', 10);
    if (isNaN(startHour) || isNaN(endHour)) return 0;
    const duration = (endHour + endMinute / 60) - (startHour + startMinute / 60);
    if (duration <= 0) return 0;
    return duration >= 6 ? duration - 1 : duration;
};

// --- Main Component ---
export default function ViewSchedulePage() {
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [currentDate, setCurrentDate] = useState(getInitialDateForPayPeriod());
  const [days, setDays] = useState<Date[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedule, setSchedule] = useState<ScheduleState>({});
  const [dailyNotes, setDailyNotes] = useState<Record<string, string>>({});
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [requests, setRequests] = useState<ShiftRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  useEffect(() => {
    const savedViewMode = localStorage.getItem('scheduleViewMode') as ViewMode;
    if (savedViewMode) setViewMode(savedViewMode);
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser) setLoggedInUser(JSON.parse(storedUser));
  }, []);

  useEffect(() => {
    localStorage.setItem('scheduleViewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      const { start, end } = getPayPeriodInterval(currentDate);
      const startDateStr = format(start, 'yyyy-MM-dd');
      const endDateStr = format(end, 'yyyy-MM-dd');
      setDays(eachDayOfInterval({ start, end }));
      try {
        const [empRes, shiftRes, noteRes, holidayRes, companyHolidayRes, requestRes] = await Promise.all([
          fetch('/api/employees', { cache: 'no-store' }),
          fetch(`/api/shifts?startDate=${startDateStr}&endDate=${endDateStr}`, { cache: 'no-store' }),
          fetch(`/api/notes?startDate=${startDateStr}&endDate=${endDateStr}`, { cache: 'no-store' }),
          fetch(`/api/holidays?startDate=${startDateStr}&endDate=${endDateStr}`, { cache: 'no-store' }),
          fetch('/api/company-holidays', { cache: 'no-store' }),
          fetch(`/api/shift-requests?startDate=${startDateStr}&endDate=${endDateStr}`, { cache: 'no-store' }),
        ]);
        if (!empRes.ok || !shiftRes.ok) throw new Error('データの取得に失敗しました。');
        
        const employeesData: Employee[] = await empRes.json();
        const shiftsData: Shift[] = await shiftRes.json();
        const notesData: DailyNote[] = await noteRes.json();
        const nationalHolidays: Holiday[] = (await holidayRes.json()).map((h: { date: string; name: string; type: 'public_holiday' }) => ({...h, date: parseISO(h.date)}));
        const companyHolidays: Holiday[] = (await companyHolidayRes.json()).map((h: { date: string; name: string; type: 'company_holiday' }) => ({...h, date: parseISO(h.date)}));
        const requestsData: ShiftRequest[] = await requestRes.json();

        if (loggedInUser && !loggedInUser.isAdmin) {
            employeesData.sort((a, b) => a.id === loggedInUser.id ? -1 : b.id === loggedInUser.id ? 1 : a.id - b.id);
        } else {
            employeesData.sort((a, b) => a.id - b.id);
        }
        setEmployees(employeesData);
        setRequests(requestsData);
        setHolidays([...nationalHolidays, ...companyHolidays].sort((a, b) => a.date.getTime() - b.date.getTime()));

        const newSchedule: ScheduleState = {};
        shiftsData.forEach(shift => {
          if (!shift.date) return;
          const dateStr = shift.date.substring(0, 10);
          const startTime = shift.start_time?.substring(0, 5);
          const endTime = shift.end_time?.substring(0, 5);
          if (!newSchedule[dateStr]) newSchedule[dateStr] = {};
          newSchedule[dateStr][shift.employee_id] = startTime && endTime ? `${startTime}-${endTime}` : '';
        });
        setSchedule(newSchedule);

        const newNotes: Record<string, string> = {};
        notesData.forEach(note => { newNotes[note.date.substring(0, 10)] = note.note; });
        setDailyNotes(newNotes);

      } catch (err) {
        setError(err instanceof Error ? err.message : '不明なエラーが発生しました。');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [currentDate, loggedInUser]);

  const totalsByEmployee = useMemo(() => {
    const totals: Record<number, number> = {};
    employees.forEach(emp => { totals[emp.id] = 0; });
    days.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (schedule[dateStr]) {
            Object.entries(schedule[dateStr]).forEach(([employeeId, time]) => {
                totals[Number(employeeId)] = (totals[Number(employeeId)] || 0) + parseShiftTime(time);
            });
        }
    });
    return totals;
  }, [schedule, employees, days]);

  const defaultTimes = useMemo(() => {
    const times: Record<number, { start: string; end: string }> = {};
    employees.forEach(emp => {
      if (emp.default_work_hours) {
        const [start, end] = emp.default_work_hours.split('-');
        times[emp.id] = { start, end };
      } else {
        times[emp.id] = { start: '', end: '' };
      }
    });
    return times;
  }, [employees]);

  if (isLoading) return <p className="p-4 text-center">スケジュールを読み込み中...</p>;
  if (error) return <p className="p-4 text-center text-red-500">{error}</p>;

  return (
    <div className="p-4 flex flex-col h-full">
      <div className="flex-shrink-0">
        <div className="flex items-center justify-center gap-4 mb-4">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="px-4 py-2 bg-gray-200 rounded">前月</button>
          <h2 className="text-xl font-semibold">{format(getPayPeriodInterval(currentDate).start, 'M/d')} - {format(getPayPeriodInterval(currentDate).end, 'M/d')}</h2>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="px-4 py-2 bg-gray-200 rounded">次月</button>
        </div>
        <div className="flex justify-center gap-2 mb-4">
          <button onClick={() => setViewMode('table')} className={`px-3 py-1 text-sm rounded ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>表</button>
          <button onClick={() => setViewMode('card')} className={`px-3 py-1 text-sm rounded ${viewMode === 'card' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>カード</button>
          <button onClick={() => setViewMode('calendar')} className={`px-3 py-1 text-sm rounded ${viewMode === 'calendar' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>カレンダー</button>
        </div>
      </div>
      
      {viewMode === 'table' && <TableView employees={employees} days={days} schedule={schedule} dailyNotes={dailyNotes} holidays={holidays} requests={requests} totalsByEmployee={totalsByEmployee} defaultTimes={defaultTimes} />}
      {viewMode === 'card' && <CardView days={days} schedule={schedule} employees={employees} loggedInUser={loggedInUser} />}
      {viewMode === 'calendar' && <CalendarView days={days} schedule={schedule} employees={employees} loggedInUser={loggedInUser} holidays={holidays} />}
    </div>
  );
}

// --- View Components ---
const TableView = ({ employees, days, schedule, dailyNotes, holidays, requests, totalsByEmployee, defaultTimes }: { employees: Employee[], days: Date[], schedule: ScheduleState, dailyNotes: Record<string, string>, holidays: Holiday[], requests: ShiftRequest[], totalsByEmployee: Record<number, number>, defaultTimes: Record<number, { start: string; end: string }> }) => (
  <div className="flex-grow overflow-auto">
    <table className="min-w-full border-collapse">
      <thead className="bg-gray-100 sticky top-0 z-10">
        <tr>
          <th className="border border-gray-300 p-2 w-28 sticky left-0 bg-gray-100 align-middle" rowSpan={3}>日付</th>
          <th className="border border-gray-300 p-2 w-24 align-middle" rowSpan={3}>備考</th>
          <th className="border border-gray-300 p-2 align-middle" rowSpan={3}>人数</th>
          {employees.map((emp: Employee) => <th key={emp.id} className="border border-gray-300 p-2 whitespace-nowrap">{emp.name}</th>)}
        </tr>
        <tr className="text-xs font-normal">
          {employees.map((emp: Employee) => <th key={emp.id} className="border border-gray-300 p-1 font-normal">{defaultTimes[emp.id]?.start}</th>)}
        </tr>
        <tr className="text-xs font-normal">
          {employees.map((emp: Employee) => <th key={emp.id} className="border border-gray-300 p-1 font-normal">{defaultTimes[emp.id]?.end}</th>)}
        </tr>
      </thead>
      <tbody>
        {days.map((day: Date) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][getDay(day)];
          const holiday = holidays.find((h: Holiday) => format(h.date, 'yyyy-MM-dd') === dateStr);
          const isWeekendOrHoliday = dayOfWeek === '日' || dayOfWeek === '土' || !!holiday;
          const headcount = Object.values(schedule[dateStr] || {}).filter((v: string) => v && v.trim() !== '').length;
          return (
            <tr key={dateStr} className={isWeekendOrHoliday ? 'bg-gray-200' : ''}>
              <td className={`border border-gray-300 p-2 whitespace-nowrap text-center w-28 sticky left-0 ${isWeekendOrHoliday ? 'font-semibold text-red-600 bg-gray-200' : 'bg-white'}`}>{format(day, 'M/d')} ({dayOfWeek})</td>
              <td className={`holiday-note border border-gray-300 w-24 text-center p-1 ${isWeekendOrHoliday ? 'text-red-600' : ''}`}>
                {dailyNotes[dateStr] || 
                  (holiday && (
                    <>
                      <span className="holiday-full-name">{holiday.name}</span>
                      <span className="holiday-short-name">
                        {holiday.type === 'public_holiday' ? '祝' : '休'}
                      </span>
                    </>
                  ))
                }
              </td>
              <td className="border border-gray-300 p-2 text-center">{headcount > 0 ? headcount : ''}</td>
              {employees.map((emp: Employee) => {
                const cellValue = schedule[dateStr]?.[emp.id];
                const isRequestedHoliday = requests.some((r: ShiftRequest) => r.employee_id === emp.id && r.date.substring(0, 10) === dateStr && r.request_type === 'holiday');
                return (
                  <td key={emp.id} className={`border border-gray-300 p-2 text-center ${isRequestedHoliday ? 'bg-gray-200' : ''}`}>
                    {cellValue ? '〇' : ''}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
      <tfoot className="bg-gray-100 font-bold sticky bottom-0 z-10">
        <tr>
            <td className="border border-gray-300 p-2 font-bold text-right sticky left-0 bg-gray-100" colSpan={3}>合計勤務時間</td>
            {employees.map((emp: Employee) => (
                <td key={emp.id} className="border border-gray-300 p-2 text-center font-bold">
                    {totalsByEmployee[emp.id] > 0 ? totalsByEmployee[emp.id].toFixed(2) : ''}
                </td>
            ))}
        </tr>
      </tfoot>
    </table>
  </div>
);

const CardView = ({ days, schedule, employees, loggedInUser }: { days: Date[], schedule: ScheduleState, employees: Employee[], loggedInUser: User | null }) => (
  <div className="flex-grow overflow-auto p-4">
    <div className="max-w-3xl mx-auto space-y-4">
      {days.map((day: Date) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const workingEmployees = employees.filter((emp: Employee) => schedule[dateStr]?.[emp.id]);
        if (workingEmployees.length > 0) {
          return (
            <div key={dateStr} className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300">
              <h3 className="font-bold text-lg mb-2 p-4 bg-gray-50 rounded-t-lg border-b">{format(day, 'M月d日 (E)', { locale: ja })}</h3>
              <ul className="divide-y divide-gray-200 p-2">
                {workingEmployees.map((emp: Employee) => (
                  <li key={emp.id} className={`flex justify-between items-center p-3 rounded-md ${emp.id === loggedInUser?.id ? 'bg-yellow-100' : ''}`}>
                    <span className="font-semibold">{emp.name}</span>
                    <span className="font-mono text-gray-700">{schedule[dateStr][emp.id]}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        return null;
      })}
    </div>
  </div>
);

const CalendarView = ({ days, schedule, employees, loggedInUser, holidays }: { days: Date[], schedule: ScheduleState, employees: Employee[], loggedInUser: User | null, holidays: Holiday[] }) => {
  const firstDayOfPeriod = days[0];
  const lastDayOfPeriod = days[days.length - 1];
  const start = startOfWeek(firstDayOfPeriod);
  const end = endOfWeek(lastDayOfPeriod);
  
  const calendarDays = eachDayOfInterval({ start, end });

  return (
    <div className="flex-grow overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="sticky top-0 bg-white z-10">
          <div className="grid grid-cols-7 gap-0.5 bg-gray-200">
            {['日', '月', '火', '水', '木', '金', '土'].map(day => (
              <div key={day} className="text-center font-bold text-gray-600 p-2">{day}</div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-7 gap-0.5 bg-gray-200">
          {calendarDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isOutsidePeriod = !isWithinInterval(day, { start: firstDayOfPeriod, end: lastDayOfPeriod });
            const workingEmployees = employees.filter((emp: Employee) => schedule[dateStr]?.[emp.id]);
            const holiday = holidays.find((h: Holiday) => format(h.date, 'yyyy-MM-dd') === dateStr);
            const isWeekend = getDay(day) === 0 || getDay(day) === 6;
            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

            return (
              <div key={dateStr} className={`border-t border-l border-gray-200 p-2 min-h-[120px] flex flex-col ${isOutsidePeriod ? 'text-gray-400 bg-gray-50' : (isWeekend || holiday) ? 'bg-red-50' : 'bg-white'}`}>
                <div className={`font-semibold text-sm mb-1 ${isToday ? 'text-blue-600 font-bold' : ''}`}>{format(day, 'd')}</div>
                {!isOutsidePeriod && (
                  <ul className="text-xs mt-1 space-y-1 flex-grow">
                    {workingEmployees.map((emp: Employee) => (
                      <li key={emp.id} className={`px-0.5 py-0.5 rounded-full text-xs ${emp.id === loggedInUser?.id ? 'bg-yellow-200 font-bold text-gray-800' : 'bg-gray-100 text-gray-700'}`}>
                        {emp.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};