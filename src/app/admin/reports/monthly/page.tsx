'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, eachDayOfInterval, getDay, parseISO, addMonths, subMonths, startOfToday } from 'date-fns';

// --- Type Definitions ---
interface Employee { id: number; name: string; hourly_wage: number; }
interface Shift { employee_id: number; date: string; start_time: string; end_time: string; }
interface Actual { shift_id: number; actual_start_time: string; actual_end_time: string; break_hours: number; }
interface ShiftWithActual extends Shift { actual_id: number | null; actual_start_time: string | null; actual_end_time: string | null; break_hours: number | null; }
interface DailyNote { date: string; note: string; }
interface Holiday { date: Date; name: string; }

// --- Helper Functions ---
const getPeriodDates = (date: Date, closingDay: string) => {
    const d = parseInt(closingDay, 10);
    let referenceDate = new Date(date);
    if (referenceDate.getDate() <= d) {
        referenceDate = subMonths(referenceDate, 1);
    }
    
    const periodStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), d + 1);
    const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, d);

    return { 
        startDate: format(periodStart, 'yyyy-MM-dd'), 
        endDate: format(periodEnd, 'yyyy-MM-dd') 
    };
};

const parseHours = (startStr: string, endStr: string, breakHours: number = 0): number => {
    if (!startStr || !endStr) return 0;
    const start = new Date(`1970-01-01T${startStr}Z`);
    const end = new Date(`1970-01-01T${endStr}Z`);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    let duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60); // duration in hours
    if (duration < 0) duration += 24; // Handle overnight shifts
    return Math.max(0, duration - breakHours);
};

export default function MonthlyReportPage() {
  // --- State ---
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [closingDay, setClosingDay] = useState('10');
  const [dateRange, setDateRange] = useState(() => getPeriodDates(new Date(), '10'));
  const [useSchedule, setUseSchedule] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<ShiftWithActual[]>([]);
  const [dailyNotes, setDailyNotes] = useState<Record<string, string>>({});
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Data Fetching ---
  useEffect(() => {
    const newDateRange = getPeriodDates(currentMonth, closingDay);
    setDateRange(newDateRange);
  }, [currentMonth, closingDay]);
  
  useEffect(() => {
    const fetchData = async () => {
      if (!dateRange.startDate || !dateRange.endDate) return;
      setIsLoading(true);
      setError(null);
      try {
        const [empRes, shiftRes, noteRes, holidayRes, companyHolidayRes] = await Promise.all([
          fetch('/api/employees'),
          fetch(`/api/shifts?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`),
          fetch(`/api/notes?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`),
          fetch(`/api/holidays?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`),
          fetch('/api/company-holidays'),
        ]);
        if (!empRes.ok || !shiftRes.ok) throw new Error('従業員またはシフトデータの取得に失敗しました。');
        
        const employeesData: Employee[] = await empRes.json();
        const shiftsData: ShiftWithActual[] = await shiftRes.json();
        const notesData: DailyNote[] = await noteRes.json();
        const nationalHolidays: Holiday[] = (await holidayRes.json()).map((h: { date: string; name: string; type: 'public_holiday' }) => ({...h, date: parseISO(h.date)}));
        const companyHolidays: Holiday[] = (await companyHolidayRes.json()).map((h: { date: string; name: string; type: 'company_holiday' }) => ({...h, date: parseISO(h.date)}));

        setEmployees(employeesData.sort((a, b) => a.id - b.id));
        setShifts(shiftsData);
        setHolidays([...nationalHolidays, ...companyHolidays]);
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
  }, [dateRange]);

  // --- Memoized Calculations ---
  const days = useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) return [];
    return eachDayOfInterval({ start: parseISO(dateRange.startDate), end: parseISO(dateRange.endDate) });
  }, [dateRange]);

  const processedData = useMemo(() => {
    const data: Record<string, Record<number, { hours: number; time: string; highlight: boolean }>> = {};
    const today = startOfToday();
    shifts.forEach(s => {
      const dateStr = s.date.substring(0, 10);
      let hours = 0;
      let time = '';
      let highlight = false;

      const hasSchedule = s.start_time && s.end_time;
      const hasActual = s.actual_start_time && s.actual_end_time;
      const isPast = parseISO(dateStr) < today;

      if (hasActual) {
        hours = parseHours(s.actual_start_time!, s.actual_end_time!, s.break_hours || 1);
        time = `${s.actual_start_time!.substring(0, 5)}-${s.actual_end_time!.substring(0, 5)}`;
      } else if (useSchedule && hasSchedule) {
        hours = parseHours(s.start_time, s.end_time, 1);
        time = `${s.start_time.substring(0, 5)}-${s.end_time.substring(0, 5)}`;
      }

      if (isPast && hasSchedule && !hasActual) {
        highlight = true;
      }

      if (hours > 0 || highlight) {
        if (!data[dateStr]) data[dateStr] = {};
        data[dateStr][s.employee_id] = { hours, time, highlight };
      }
    });
    return data;
  }, [shifts, useSchedule]);

  const employeeTotals = useMemo(() => {
    const totals: Record<number, { days: number; hours: number; salary: number }> = {};
    employees.forEach(emp => { totals[emp.id] = { days: 0, hours: 0, salary: 0 }; });
    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      employees.forEach(emp => {
        const hours = processedData[dateStr]?.[emp.id]?.hours || 0;
        if (hours > 0) {
          totals[emp.id].days += 1;
          totals[emp.id].hours += hours;
          totals[emp.id].salary += hours * emp.hourly_wage;
        }
      });
    });
    return totals;
  }, [processedData, employees, days]);

  const grandTotals = useMemo(() => {
    return Object.values(employeeTotals).reduce((acc, curr) => {
      acc.days += curr.days;
      acc.hours += curr.hours;
      acc.salary += curr.salary;
      return acc;
    }, { days: 0, hours: 0, salary: 0 });
  }, [employeeTotals]);

  // --- Render ---
  return (
    <div className="p-4 flex flex-col">
      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6 flex flex-wrap items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-4">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="px-4 py-2 bg-gray-200 rounded-md">前月</button>
            <div className="text-center">
                <h2 className="text-lg font-semibold">{format(currentMonth, 'yyyy年 M月度')}</h2>
                <p className="text-xs text-gray-500">({dateRange.startDate} ~ {dateRange.endDate})</p>
            </div>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="px-4 py-2 bg-gray-200 rounded-md">次月</button>
        </div>
        <div className="flex items-end gap-4 flex-wrap md:flex-nowrap justify-end">
            <div className="w-full sm:w-auto">
                <label htmlFor="closingDay" className="block text-sm font-medium text-gray-700">締め日</label>
                <select id="closingDay" value={closingDay} onChange={(e) => setClosingDay(e.target.value)} className="mt-1 block w-full form-select">
                    <option value="10">10日締め</option>
                    <option value="20">20日締め</option>
                </select>
            </div>
            <div className="flex items-center pt-4 sm:pt-0">
                <input type="checkbox" id="useSchedule" checked={useSchedule} onChange={(e) => setUseSchedule(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                <label htmlFor="useSchedule" className="ml-2 block text-sm text-gray-900">未入力の実績をシフト予定で補完する</label>
            </div>
        </div>
      </div>

      {/* Report Table */}
      {error && <p className="text-center text-red-500 flex-grow">{error}</p>}
      {isLoading && <p className="text-center flex-grow">読み込み中...</p>}
      {!isLoading && (
        <div className="overflow-auto" style={{maxHeight: 'calc(100vh - 250px)'}}>
          <table className="min-w-full border-collapse">
            <thead style={{ backgroundColor: '#f9fafb' }} className="sticky top-0 z-10">
              <tr>
                <th style={{ border: '1px solid #d1d5db' }} className="p-2 w-28 sticky left-0 bg-gray-100">日付</th>
                <th style={{ border: '1px solid #d1d5db' }} className="p-2 w-24">備考</th>
                {employees.map((emp) => <th key={emp.id} style={{ border: '1px solid #d1d5db' }} className="p-2 whitespace-nowrap">{emp.name}</th>)}
                <th style={{ border: '1px solid #d1d5db' }} className="p-2 w-24">日別合計</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const holiday = holidays.find(h => format(h.date, 'yyyy-MM-dd') === dateStr);
                const isWeekend = getDay(day) === 0 || getDay(day) === 6;
                const dailyTotal = employees.reduce((acc, emp) => acc + (processedData[dateStr]?.[emp.id]?.hours || 0), 0);
                return (
                  <tr key={dateStr} className={isWeekend || !!holiday ? 'bg-gray-200' : ''}>
                    <td style={{ border: '1px solid #d1d5db' }} className={`p-2 whitespace-nowrap text-center w-28 sticky left-0 ${isWeekend || !!holiday ? 'font-semibold text-red-600 bg-gray-200' : 'bg-white'}`}>{format(day, 'M/d')} ({['日', '月', '火', '水', '木', '金', '土'][getDay(day)]})</td>
                    <td style={{ border: '1px solid #d1d5db', color: holiday ? 'red' : 'inherit' }} className="p-1 text-center">{dailyNotes[dateStr] || holiday?.name || ''}</td>
                    {employees.map(emp => {
                      const cellData = processedData[dateStr]?.[emp.id];
                      const cellClass = cellData?.highlight ? 'bg-yellow-200' : '';
                      return (
                        <td key={emp.id} style={{ border: '1px solid #d1d5db' }} className={`p-2 text-center text-sm leading-tight ${cellClass}`}>
                          {cellData?.time && <div>{cellData.time}</div>}
                          {cellData?.hours > 0 && <div className="text-xs text-gray-500">({cellData.hours.toFixed(2)}h)</div>}
                        </td>
                      );
                    })}
                    <td style={{ border: '1px solid #d1d5db' }} className="p-2 text-center font-semibold">{dailyTotal > 0 ? dailyTotal.toFixed(2) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 10, backgroundColor: '#f9fafb' }} className="font-bold">
              <tr>
                <td style={{ border: '1px solid #d1d5db' }} className="p-2 text-right sticky left-0 bg-gray-100" colSpan={2}>合計勤務日数</td>
                {employees.map(emp => <td key={emp.id} style={{ border: '1px solid #d1d5db' }} className="p-2 text-center">{employeeTotals[emp.id]?.days || ''}</td>)}
                <td style={{ border: '1px solid #d1d5db' }} className="p-2 text-center">{grandTotals.days > 0 ? grandTotals.days : ''}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #d1d5db' }} className="p-2 text-right sticky left-0 bg-gray-100" colSpan={2}>合計勤務時間</td>
                {employees.map(emp => <td key={emp.id} style={{ border: '1px solid #d1d5db' }} className="p-2 text-center">{employeeTotals[emp.id]?.hours.toFixed(2) || ''}</td>)}
                <td style={{ border: '1px solid #d1d5db' }} className="p-2 text-center">{grandTotals.hours > 0 ? grandTotals.hours.toFixed(2) : ''}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #d1d5db' }} className="p-2 text-right sticky left-0 bg-gray-100" colSpan={2}>合計概算給与</td>
                {employees.map(emp => <td key={emp.id} style={{ border: '19x solid #d1d5db' }} className="p-2 text-center">￥{Math.round(employeeTotals[emp.id]?.salary || 0).toLocaleString()}</td>)}
                <td style={{ border: '1px solid #d1d5db' }} className="p-2 text-center">￥{Math.round(grandTotals.salary).toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
