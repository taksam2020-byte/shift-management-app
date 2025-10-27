'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, eachDayOfInterval, getDay, addMonths, subMonths, startOfWeek, parseISO } from 'date-fns';
import ShiftInput from '@/components/ShiftInput';

// --- Type Definitions ---
interface Employee { 
  id: number; 
  name: string; 
  hourly_wage: number;
  default_work_hours?: string | null; 
  max_weekly_hours?: number | null; 
  max_weekly_days?: number | null; 
  annual_income_limit?: number | null;
}
interface ShiftRequest { employee_id: number; date: string; request_type: 'holiday' | 'work'; }
interface Shift { employee_id: number; date: string; start_time: string; end_time: string; }
interface DailyNote { date: string; note: string; }
interface Holiday { date: Date; name: string; }
type ScheduleState = Record<string, Record<number, string>>;
type ValidationErrorState = Record<string, Record<number, string | null>>;
type DailyNoteState = Record<string, string>;
type AnnualIncomeState = Record<number, { totalIncome: number; remainingDays: number | null; }>;

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

const parseShiftTime = (time: string, withBreak: boolean = false): number => {
    if (!time || !time.includes('-')) return 0;
    const [start, end] = time.split('-');
    const startHour = parseInt(start.split(':')[0], 10);
    const startMinute = parseInt(start.split(':')[1] || '0', 10);
    const endHour = parseInt(end.split(':')[0], 10);
    const endMinute = parseInt(end.split(':')[1] || '0', 10);
    if (isNaN(startHour) || isNaN(endHour)) return 0;
    const duration = (endHour + endMinute / 60) - (startHour + startMinute / 60);
    if (withBreak && duration >= 6) { return duration - 1; }
    return duration > 0 ? duration : 0;
};

export default function SchedulePage() {
  // --- State ---
  const [currentDate, setCurrentDate] = useState(getInitialDateForPayPeriod());
  const [days, setDays] = useState<Date[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [requests, setRequests] = useState<ShiftRequest[]>([]);
  const [schedule, setSchedule] = useState<ScheduleState>({});
  const [dailyNotes, setDailyNotes] = useState<DailyNoteState>({});
  const [initialDailyNotes, setInitialDailyNotes] = useState<DailyNoteState>({}); // For diffing on save
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationErrorState>({});
  const [annualIncomes, setAnnualIncomes] = useState<AnnualIncomeState>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Validation Logic ---
  const validateSchedule = useCallback((currentSchedule: ScheduleState, allEmployees: Employee[]) => {
    const newErrors: ValidationErrorState = {};
    allEmployees.forEach(emp => {
        if (!emp.max_weekly_hours && !emp.max_weekly_days) return;
        const weeklyTotals: Record<string, { hours: number; days: number }> = {};
        Object.entries(currentSchedule).forEach(([dateStr, dailyShifts]) => {
            const shift = dailyShifts[emp.id];
            if (shift && shift.trim() !== '') {
                const weekStart = format(startOfWeek(parseISO(dateStr), { weekStartsOn: 1 }), 'yyyy-MM-dd');
                if (!weeklyTotals[weekStart]) { weeklyTotals[weekStart] = { hours: 0, days: 0 }; }
                const hours = parseShiftTime(shift, true);
                if (hours > 0) { weeklyTotals[weekStart].hours += hours; }
                weeklyTotals[weekStart].days += 1;
            }
        });
        Object.entries(currentSchedule).forEach(([dateStr, dailyShifts]) => {
            if (dailyShifts[emp.id]) {
                const weekStart = format(startOfWeek(parseISO(dateStr), { weekStartsOn: 1 }), 'yyyy-MM-dd');
                const totals = weeklyTotals[weekStart];
                if (!totals) return;
                let errorMsg = null;
                if (emp.max_weekly_hours && totals.hours > emp.max_weekly_hours) { errorMsg = `週${totals.hours.toFixed(1)}h/${emp.max_weekly_hours}h`; }
                if (emp.max_weekly_days && totals.days > emp.max_weekly_days) { errorMsg = `${errorMsg || ''} 週${totals.days}d/${emp.max_weekly_days}d`.trim(); }
                if (errorMsg) {
                    if (!newErrors[dateStr]) newErrors[dateStr] = {};
                    newErrors[dateStr][emp.id] = errorMsg;
                }
            }
        });
    });
    setValidationErrors(newErrors);
  }, []);

  // --- Data Fetching ---
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      const { start, end } = getPayPeriodInterval(currentDate);
      const fetchStart = new Date(start);
      fetchStart.setDate(start.getDate() - 7);
      const fetchEnd = new Date(end);
      fetchEnd.setDate(end.getDate() + 7);
      const startDateStr = format(fetchStart, 'yyyy-MM-dd');
      const endDateStr = format(fetchEnd, 'yyyy-MM-dd');
      setDays(eachDayOfInterval({ start, end }));
      try {
        const [empRes, reqRes, shiftRes, noteRes, holidayRes, companyHolidayRes] = await Promise.all([
          fetch('/api/employees'),
          fetch(`/api/shift-requests?startDate=${startDateStr}&endDate=${endDateStr}`),
          fetch(`/api/shifts?startDate=${startDateStr}&endDate=${endDateStr}`),
          fetch(`/api/notes?startDate=${startDateStr}&endDate=${endDateStr}`),
          fetch(`/api/holidays?startDate=${startDateStr}&endDate=${endDateStr}`),
          fetch('/api/company-holidays'),
        ]);
        if (!empRes.ok || !reqRes.ok || !shiftRes.ok || !noteRes.ok || !holidayRes.ok || !companyHolidayRes.ok) throw new Error('データの取得に失敗しました。');
        const employeesData: Employee[] = await empRes.json();
        const requestsData: ShiftRequest[] = await reqRes.json();
        const shiftsData: Shift[] = await shiftRes.json();
        const notesData: DailyNote[] = await noteRes.json();
        const nationalHolidays: Holiday[] = (await holidayRes.json()).map((h: { date: string; name: string }) => ({...h, date: parseISO(h.date)}));
        const companyHolidays: Holiday[] = (await companyHolidayRes.json()).map((h: { date: string; note: string }) => ({...h, date: parseISO(h.date), name: h.note || '会社休日'}));

        const allHolidays = [...nationalHolidays, ...companyHolidays].sort((a, b) => a.date.getTime() - b.date.getTime());

        setEmployees(employeesData);
        setRequests(requestsData);
        setHolidays(allHolidays);

        // --- Fetch and calculate annual income data ---
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const incomePromises = employeesData.map(emp => 
            fetch(`/api/reports/annual-summary?employeeId=${emp.id}&year=${year}&untilMonth=${month}`)
                .then(res => res.json())
                .then(data => ({ ...data, employeeId: emp.id }))
        );
        const incomeResults = await Promise.all(incomePromises);
        const newAnnualIncomes: AnnualIncomeState = {};
        incomeResults.forEach(result => {
            if (result.employeeId) {
                newAnnualIncomes[result.employeeId] = { totalIncome: result.totalIncome, remainingDays: null };
            }
        });
        setAnnualIncomes(newAnnualIncomes);
        // --- End of annual income fetching ---

        const initialSchedule: ScheduleState = {};
        requestsData.forEach(req => {
            if (req.request_type === 'work') {
                const employee = employeesData.find(e => e.id === req.employee_id);
                if (employee) {
                    const dateStr = req.date.substring(0, 10); // Normalize to YYYY-MM-DD
                    if (!initialSchedule[dateStr]) initialSchedule[dateStr] = {};
                    initialSchedule[dateStr][req.employee_id] = employee.default_work_hours || '09:00-17:00';
                }
            }
        });
        shiftsData.forEach(shift => {
          if (!shift.date) return;
          const dateStr = shift.date.substring(0, 10); // YYYY-MM-DD形式に整形
          const startTime = shift.start_time ? shift.start_time.substring(0, 5) : null; // HH:MM形式に整形
          const endTime = shift.end_time ? shift.end_time.substring(0, 5) : null; // HH:MM形式に整形

          if (!initialSchedule[dateStr]) {
            initialSchedule[dateStr] = {};
          }
          initialSchedule[dateStr][shift.employee_id] = startTime && endTime ? `${startTime}-${endTime}` : '';
        });
        setSchedule(initialSchedule);
        validateSchedule(initialSchedule, employeesData);

        const newNotes: DailyNoteState = {};
        notesData.forEach(note => { 
          const dateStr = note.date.substring(0, 10);
          newNotes[dateStr] = note.note; 
        });
        setDailyNotes(newNotes);
        setInitialDailyNotes(newNotes);

      } catch (err) {
        setError(err instanceof Error ? err.message : '不明なエラーが発生しました。');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [currentDate, validateSchedule]);

  // --- Event Handlers ---
  const handleScheduleChange = (date: string, employeeId: number, value: string) => {
    const newSchedule = { ...schedule, [date]: { ...schedule[date], [employeeId]: value } };
    setSchedule(newSchedule);
    validateSchedule(newSchedule, employees);
  };

  const handleNoteChange = (date: string, value: string) => {
    setDailyNotes(prev => ({ ...prev, [date]: value }));
  };

  const handleSave = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      // --- Diffs for Shifts (if needed in future, for now it sends all) ---
      const shiftsToSave: Omit<Shift, 'id'>[] = [];
      Object.entries(schedule).forEach(([date, dailyShifts]) => {
        Object.entries(dailyShifts).forEach(([employeeId, time]) => {
          const [start_time, end_time] = time ? time.split('-').map(t => t.trim()) : ['', ''];
          shiftsToSave.push({ employee_id: Number(employeeId), date, start_time, end_time });
        });
      });

      // --- Diffing for Notes ---
      const notesToSave: {date: string, note: string}[] = [];
      const allNoteDates = new Set([...Object.keys(dailyNotes), ...Object.keys(initialDailyNotes)]);
      
      allNoteDates.forEach(date => {
        const currentDateStr = date.substring(0, 10);
        const initialNote = initialDailyNotes[currentDateStr] || '';
        const currentNote = dailyNotes[currentDateStr] || '';

        if (initialNote !== currentNote) {
          notesToSave.push({ date: currentDateStr, note: currentNote });
        }
      });

      if (notesToSave.length === 0 && shiftsToSave.length > 0) {
         // Only save shifts if notes haven't changed
      } else if (notesToSave.length === 0) {
        alert("変更点がありません。");
        setIsLoading(false);
        return;
      }

      // --- API Calls ---
      const shiftResponse = await fetch('/api/shifts', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(shiftsToSave) 
      });

      if (!shiftResponse.ok) {
        const errorData = await shiftResponse.json();
        throw new Error(`シフトの保存に失敗しました: ${errorData.details || shiftResponse.statusText}`);
      }

      const noteSavePromises = notesToSave.map(note => 
        fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(note)
        }).then(res => {
          if (!res.ok) {
            return res.json().then(err => Promise.reject(err));
          }
          return res.json();
        })
      );

      await Promise.all(noteSavePromises);

      alert('シフトと備考を保存しました。');
      // Update the baseline after a successful save
      setInitialDailyNotes(dailyNotes);

    } catch (err: unknown) {
      console.error('Save failed:', err);
      let errorMessage = '保存中にエラーが発生しました。';
      if (err instanceof Error) {
          errorMessage = err.message;
      } else if (err && typeof err === 'object' && 'error' in err) {
          errorMessage = String((err as { error: unknown }).error);
      }
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSchedule = async () => {
    setIsLoading(true);
    setError(null);
    try {
        const { start, end } = getPayPeriodInterval(currentDate);
        const response = await fetch('/api/shifts/generate-schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                startDate: format(start, 'yyyy-MM-dd'), 
                endDate: format(end, 'yyyy-MM-dd') 
            }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '自動作成に失敗しました。');
        }
        const generatedSchedule = await response.json();
        
        const newSchedule: ScheduleState = { ...schedule };
        Object.entries(generatedSchedule).forEach(([date, shifts]) => {
            if (!newSchedule[date]) newSchedule[date] = {};
            Object.entries(shifts as Record<string, string>).forEach(([empId, time]) => {
                newSchedule[date][Number(empId)] = time === '休み' ? '' : time;
            });
        });

        setSchedule(newSchedule);
        validateSchedule(newSchedule, employees);

    } catch (err) {
        alert(err instanceof Error ? err.message : '自動作成中にエラーが発生しました。');
    } finally {
        setIsLoading(false);
    }
  };

  // --- Render ---
  const totalsByEmployee = useMemo(() => {
    const totals: Record<number, number> = {};
    employees.forEach(emp => { totals[emp.id] = 0; });
    days.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (schedule[dateStr]) {
            Object.entries(schedule[dateStr]).forEach(([employeeId, time]) => {
                totals[Number(employeeId)] += parseShiftTime(time, true);
            });
        }
    });
    return totals;
  }, [schedule, employees, days]);

  // --- Calculate and update remaining days ---
  useEffect(() => {
    if (!employees.length || !Object.keys(annualIncomes).length) return;

    const newAnnualIncomes: AnnualIncomeState = { ...annualIncomes };

    employees.forEach(emp => {
        const annualIncomeLimit = emp.annual_income_limit;
        if (!annualIncomeLimit) return; // Skip if no limit is set

        const pastIncome = annualIncomes[emp.id]?.totalIncome || 0;
        
        let thisMonthProjectedIncome = 0;
        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const shiftTime = schedule[dateStr]?.[emp.id];
            if (shiftTime) {
                const hours = parseShiftTime(shiftTime, true);
                thisMonthProjectedIncome += hours * emp.hourly_wage;
            }
        });

        const remainingMonths = 12 - (currentDate.getMonth());
        const remainingAnnualBudget = annualIncomeLimit - pastIncome;
        const averageMonthlyBudget = remainingAnnualBudget / remainingMonths;
        const remainingThisMonthBudget = averageMonthlyBudget - thisMonthProjectedIncome;

        let remainingDays = null;
        const dailyWage = (emp.default_work_hours ? parseShiftTime(emp.default_work_hours, true) : 8) * emp.hourly_wage;
        if (dailyWage > 0) {
            remainingDays = remainingThisMonthBudget / dailyWage;
        }
        
        newAnnualIncomes[emp.id] = { ...newAnnualIncomes[emp.id], remainingDays };
    });

    setAnnualIncomes(newAnnualIncomes);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, employees, days, currentDate]);

  if (isLoading) return <p className="p-4 text-center">スケジュールを読み込み中...</p>;
  if (error) return <p className="p-4 text-center text-red-500">{error}</p>;

  return (
    <div className="p-4 flex flex-col h-full">
      <div className="flex-shrink-0">
        <div className="flex items-center justify-center gap-4 mb-4">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="px-4 py-2 bg-gray-200 rounded">前月</button>
          <h2 className="text-xl font-semibold">{format(currentDate, 'yyyy年 M月')} ({format(getPayPeriodInterval(currentDate).start, 'M/d')} - {format(getPayPeriodInterval(currentDate).end, 'M/d')})</h2>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="px-4 py-2 bg-gray-200 rounded">次月</button>
        </div>
        <div className="flex gap-4 mb-4">
          <button onClick={handleGenerateSchedule} className="w-full py-2 px-4 bg-green-500 text-white font-bold rounded hover:bg-green-600 disabled:bg-gray-400" disabled={isLoading}>仮シフト自動作成</button>
          <button onClick={handleSave} className="w-full py-2 px-4 bg-blue-500 text-white font-bold rounded hover:bg-blue-600 disabled:bg-gray-400" disabled={isLoading}>このスケジュールを保存する</button>
        </div>
      </div>
      <div className="flex-grow overflow-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr>
              <th className="border border-gray-300 p-2 w-28">日付</th>
              <th className="border border-gray-300 p-2 w-24">備考</th>
              <th className="border border-gray-300 p-2">人数</th>
              {employees.map((emp) => <th key={emp.id} className="border border-gray-300 p-2 whitespace-nowrap">{emp.name}</th>)}
              <th className="border border-gray-300 p-2">日別合計</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][getDay(day)];
              const holiday = holidays.find(h => format(h.date, 'yyyy-MM-dd') === dateStr);
              const isWeekendOrHoliday = dayOfWeek === '日' || dayOfWeek === '土' || !!holiday;
              const dailyShifts = schedule[dateStr] || {};
              const headcount = Object.values(dailyShifts).filter(v => v && v.trim() !== '').length;
              const dailyTotalHours = Object.values(dailyShifts).reduce((acc, time) => acc + parseShiftTime(time, true), 0);

              return (
                <tr key={dateStr} className={isWeekendOrHoliday ? 'bg-gray-200' : ''}>
                  <td className={`border border-gray-300 p-2 whitespace-nowrap text-center w-28 ${isWeekendOrHoliday ? 'font-semibold text-red-600' : ''}`}>{format(day, 'M/d')} ({dayOfWeek})</td>
                  <td className="border border-gray-300 w-24"><input type="text" value={dailyNotes[dateStr] || holiday?.name || ''} onChange={(e) => handleNoteChange(dateStr, e.target.value)} disabled={!!holiday} className={`w-full p-1 bg-transparent focus:outline-none focus:bg-white text-center ${isWeekendOrHoliday ? 'text-red-600' : ''} ${!!holiday ? 'cursor-not-allowed' : ''}`}/></td>
                  <td className="border border-gray-300 p-2 text-center">{headcount > 0 ? headcount : ''}</td>
                  {employees.map((emp) => {
                    const request = requests.find(r => r.employee_id === emp.id && r.date.substring(0, 10) === dateStr);
                    const cellValue = schedule[dateStr]?.[emp.id] || '';
                    const validationError = validationErrors[dateStr]?.[emp.id];
                    return (
                      <td key={emp.id} className={`border border-gray-300 p-0 align-middle text-center ${validationError ? 'bg-red-200' : ''}`}>
                        <ShiftInput 
                          value={cellValue} 
                          onChange={(newValue) => handleScheduleChange(dateStr, emp.id, newValue)}
                          isRequested={!!request}
                          requestType={request?.request_type}
                          defaultHours={emp.default_work_hours || ''}
                          title={validationError || ''}
                        />
                      </td>
                    );
                  })}
                  <td className="border border-gray-300 p-2 text-center font-semibold">{dailyTotalHours > 0 ? dailyTotalHours.toFixed(2) : ''}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-100 sticky bottom-0 z-10">
            <tr>
                <td className="border border-gray-300 p-2 font-bold text-right sticky left-0 bg-gray-100" colSpan={3}>合計勤務時間</td>
                {employees.map(emp => (
                    <td key={emp.id} className="border border-gray-300 p-2 text-center font-bold">
                        {totalsByEmployee[emp.id] > 0 ? totalsByEmployee[emp.id].toFixed(2) : ''}
                    </td>
                ))}
                <td className="border border-gray-300 p-2"></td>
            </tr>
            <tr>
                <td className="border border-gray-300 p-2 font-bold text-right sticky left-0 bg-gray-100" colSpan={3}>残勤務日数(目安)</td>
                {employees.map(emp => {
                    const remainingDays = annualIncomes[emp.id]?.remainingDays;
                    const hasLimit = emp.annual_income_limit && emp.annual_income_limit > 0;
                    let textColor = 'text-gray-500';
                    if (remainingDays !== null) {
                        if (remainingDays < 0) textColor = 'text-red-500 font-bold';
                        else if (remainingDays < 5) textColor = 'text-yellow-500';
                    }
                    return (
                        <td key={emp.id} className={`border border-gray-300 p-2 text-center font-semibold ${textColor}`}>
                            {hasLimit ? (remainingDays !== null ? remainingDays.toFixed(1) : '-') : '-'}
                        </td>
                    );
                })}
                <td className="border border-gray-300 p-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
