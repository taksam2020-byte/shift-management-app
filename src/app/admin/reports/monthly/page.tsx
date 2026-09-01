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
    if (d === 31) {
        // 末締め
        const periodStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
        const periodEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
        return { 
            startDate: format(periodStart, 'yyyy-MM-dd'), 
            endDate: format(periodEnd, 'yyyy-MM-dd') 
        };
    }
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
  const [user, setUser] = useState<{ isViewer?: boolean } | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser) setUser(JSON.parse(storedUser));
  }, []);

  // --- State ---
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [closingDay, setClosingDay] = useState('31');
  const [dateRange, setDateRange] = useState(() => getPeriodDates(new Date(), '31'));
  const [useSchedule, setUseSchedule] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
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
        const empQuery = showInactive ? '?include_inactive=true' : '';
        const [empRes, shiftRes, noteRes, holidayRes, companyHolidayRes] = await Promise.all([
          fetch(`/api/employees${empQuery}`),
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
  }, [dateRange, showInactive]);

  // --- Memoized Calculations ---
  const days = useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) return [];
    return eachDayOfInterval({ start: parseISO(dateRange.startDate), end: parseISO(dateRange.endDate) });
  }, [dateRange]);

  const processedData = useMemo(() => {
    const data: Record<string, Record<number, { hours: number; time: string; highlight: boolean }>> = {};
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    shifts.forEach(s => {
      const dateStr = s.date.substring(0, 10);
      let hours = 0;
      let time = '';
      let highlight = false;

      const hasSchedule = !!(s.start_time && s.end_time);
      const hasActual = !!s.actual_id;
      const isPastOrToday = dateStr <= todayStr;

      if (hasActual) {
        hours = parseHours(s.actual_start_time || '', s.actual_end_time || '', s.break_hours || 1);
        time = `${s.actual_start_time?.substring(0, 5) || ''}-${s.actual_end_time?.substring(0, 5) || ''}`;
      } else if (useSchedule && hasSchedule) {
        hours = parseHours(s.start_time, s.end_time, 1);
        time = `${s.start_time.substring(0, 5)}-${s.end_time.substring(0, 5)}`;
      }

      if (isPastOrToday && hasSchedule && !hasActual) {
        highlight = true;
        if (!useSchedule) {
            time = '未入力';
        }
      }

      if (hours > 0 || highlight) {
        if (!data[dateStr]) data[dateStr] = {};
        data[dateStr][s.employee_id] = { hours, time, highlight };
      }
    });
    return data;
  }, [shifts, useSchedule]);

  const employeeTotals = useMemo(() => {
    const totals: Record<number, { days: number; hours: number; salary: number; unconfirmed: number }> = {};
    employees.forEach(emp => { totals[emp.id] = { days: 0, hours: 0, salary: 0, unconfirmed: 0 }; });
    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      employees.forEach(emp => {
        const hours = processedData[dateStr]?.[emp.id]?.hours || 0;
        const highlight = processedData[dateStr]?.[emp.id]?.highlight;
        if (hours > 0) {
          totals[emp.id].days += 1;
          totals[emp.id].hours += hours;
          totals[emp.id].salary += hours * emp.hourly_wage;
        }
        if (highlight) {
          totals[emp.id].unconfirmed += 1;
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
      acc.unconfirmed += curr.unconfirmed;
      return acc;
    }, { days: 0, hours: 0, salary: 0, unconfirmed: 0 });
  }, [employeeTotals]);

  // --- Render ---
  return (
    <div className="p-4 flex flex-col">
      {/* Controls & Alert */}
      <div className="bg-white p-2 rounded-lg shadow-md mb-4 flex flex-wrap items-center justify-between gap-4">
        {/* 左側: 月切替とコントロール */}
        <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="px-3 py-1.5 bg-gray-200 rounded-md text-sm hover:bg-gray-300">前月</button>
                <div className="text-center p-1 px-2">
                    <h2 className="text-base font-semibold whitespace-nowrap">{format(currentMonth, 'yyyy年 M月度')}</h2>
                    <p className="text-[10px] text-gray-500">({dateRange.startDate} ~ {dateRange.endDate})</p>
                </div>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="px-3 py-1.5 bg-gray-200 rounded-md text-sm hover:bg-gray-300">次月</button>
            </div>

            <div className="flex items-center gap-4 border-l pl-6 border-gray-300">
                <div className="flex items-center gap-2">
                  <label htmlFor="closingDay" className="text-sm font-medium text-gray-700 whitespace-nowrap" title="集計期間を変更します。20日締めなら「前月21日〜当月20日」となります。">締め日 <span className="text-gray-400 cursor-help font-normal">ⓘ</span>:</label>
                  <select id="closingDay" value={closingDay} onChange={(e) => setClosingDay(e.target.value)} className="form-select text-sm py-1 pl-2 pr-8">
                    <option value="31">末締め</option>
                    <option value="20">20日締め</option>
                  </select>
                </div>
                <div className="flex items-center" title="実績が未入力（打刻漏れ等）の日について、シフトで予定されていた時間を出勤したものとして計算します。">
                  <input type="checkbox" id="useSchedule" checked={useSchedule} onChange={(e) => setUseSchedule(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <label htmlFor="useSchedule" className="ml-2 text-sm text-gray-900 whitespace-nowrap cursor-pointer">未入力の実績を予定で補完 <span className="text-gray-400 cursor-help">ⓘ</span></label>
                </div>
                <div className="flex items-center ml-2 border-l pl-4 border-gray-200" title="過去の集計を確認するために、すでに退職済（非表示）となった従業員のデータも表示します。">
                  <input type="checkbox" id="showInactive" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-gray-600 focus:ring-gray-500" />
                  <label htmlFor="showInactive" className="ml-2 text-sm text-gray-600 whitespace-nowrap cursor-pointer">退職者も表示する <span className="text-gray-400 cursor-help">ⓘ</span></label>
                </div>
            </div>
        </div>

        {/* 右側: アラート (ある場合のみ) */}
        {grandTotals.unconfirmed > 0 && (
            <div className="flex-grow flex justify-end">
                <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-2 rounded-md shadow-sm flex items-center text-sm">
                  <svg className="w-5 h-5 mr-2 text-yellow-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
                  <div>
                      <span className="font-bold">未入力が {grandTotals.unconfirmed} 件あります</span>
                      <span className="text-yellow-700 ml-2 hidden lg:inline">従業員の実績入力画面から保存を完了させてください。</span>
                  </div>
                </div>
            </div>
        )}
      </div>

      {/* Report Table */}
      {error && <p className="text-center text-red-500 flex-grow">{error}</p>}
      {isLoading && <p className="text-center flex-grow">読み込み中...</p>}
      {!isLoading && (
        <div className="overflow-auto" style={{maxHeight: 'calc(100vh - 250px)'}}>
          <table className="min-w-full border-collapse">
            <thead style={{ backgroundColor: '#f9fafb' }} className="sticky top-0 z-10">
              <tr>
                <th style={{ border: '1px solid #d1d5db' }} className="p-1 w-28 sticky left-0 bg-gray-100">日付</th>
                <th style={{ border: '1px solid #d1d5db' }} className="p-1 w-24">備考</th>
                {employees.map((emp) => <th key={emp.id} style={{ border: '1px solid #d1d5db' }} className="p-1 whitespace-nowrap">{emp.name}</th>)}
                <th style={{ border: '1px solid #d1d5db' }} className="p-1 w-24">日別合計</th>
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
                    <td style={{ border: '1px solid #d1d5db' }} className={`p-1 whitespace-nowrap text-center w-28 sticky left-0 ${isWeekend || !!holiday ? 'font-semibold text-red-600 bg-gray-200' : 'bg-white'}`}>{format(day, 'M/d')} ({['日', '月', '火', '水', '木', '金', '土'][getDay(day)]})</td>
                    <td style={{ border: '1px solid #d1d5db', color: holiday ? 'red' : 'inherit' }} className="p-1 text-center">{dailyNotes[dateStr] || holiday?.name || ''}</td>
                    {employees.map(emp => {
                      const cellData = processedData[dateStr]?.[emp.id];
                      const cellClass = cellData?.highlight ? 'bg-yellow-200' : '';
                      return (
                        <td key={emp.id} style={{ border: '1px solid #d1d5db' }} className={`p-1 text-center text-sm leading-tight ${cellClass}`}>
                          {cellData?.time && <div>{cellData.time}</div>}
                          {cellData?.hours > 0 && <div className="text-xs text-gray-500">({cellData.hours.toFixed(2)}h)</div>}
                        </td>
                      );
                    })}
                    <td style={{ border: '1px solid #d1d5db' }} className="p-1 text-center font-semibold">{dailyTotal > 0 ? dailyTotal.toFixed(2) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 10, backgroundColor: '#f9fafb' }} className="font-bold">
              <tr>
                <td style={{ border: '1px solid #d1d5db' }} className="p-1 text-right sticky left-0 bg-gray-100" colSpan={2}>合計勤務日数</td>
                {employees.map(emp => <td key={emp.id} style={{ border: '1px solid #d1d5db' }} className="p-1 text-center">{employeeTotals[emp.id]?.days || ''}</td>)}
                <td style={{ border: '1px solid #d1d5db' }} className="p-1 text-center">{grandTotals.days > 0 ? grandTotals.days : ''}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #d1d5db' }} className="p-1 text-right sticky left-0 bg-gray-100" colSpan={2}>合計勤務時間</td>
                {employees.map(emp => <td key={emp.id} style={{ border: '1px solid #d1d5db' }} className="p-1 text-center">{employeeTotals[emp.id]?.hours.toFixed(2) || ''}</td>)}
                <td style={{ border: '1px solid #d1d5db' }} className="p-1 text-center">{grandTotals.hours > 0 ? grandTotals.hours.toFixed(2) : ''}</td>
              </tr>
              {!user?.isViewer && (
                <tr>
                  <td style={{ border: '1px solid #d1d5db' }} className="p-1 text-right sticky left-0 bg-gray-100" colSpan={2} title="シフト時間と時給から計算した概算です。実際の支給額とは異なる場合があります。">合計概算給与 <span className="text-gray-500 cursor-help font-normal text-xs">ⓘ</span></td>
                  {employees.map(emp => <td key={emp.id} style={{ border: '1px solid #d1d5db' }} className="p-1 text-center">￥{Math.round(employeeTotals[emp.id]?.salary || 0).toLocaleString()}</td>)}
                  <td style={{ border: '1px solid #d1d5db' }} className="p-1 text-center">￥{Math.round(grandTotals.salary).toLocaleString()}</td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
