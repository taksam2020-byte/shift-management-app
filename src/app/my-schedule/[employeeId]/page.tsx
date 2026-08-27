'use client';

import { useState, useEffect, FormEvent, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, parseISO, isPast, getDay, addMonths, subMonths, eachDayOfInterval } from 'date-fns';
import ActualsInput from '@/components/ActualsInput';
import Link from 'next/link';

// --- Type Definitions ---
interface ShiftRequest { employee_id: number; date: string; request_type: 'holiday' | 'work'; }

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

interface Employee { 
  id: number; 
  name: string; 
  hourly_wage: number;
  group_name?: string | null;
  max_weekly_hours?: number | null;
  max_weekly_days?: number | null;
  annual_income_limit?: number | null;
  default_work_hours?: string | null;
  request_type?: 'holiday' | 'work';
  created_at?: string;
  initial_income?: number | null;
  initial_income_year?: number | null;
}

interface User {
  id: number;
  name: string;
  isAdmin: boolean;
}

// --- Helper ---
const getPayPeriodInterval = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return { start, end };
};

const getInitialDateForPayPeriod = () => {
  return new Date();
};

const calculateDuration = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    if (isNaN(startHour) || isNaN(endHour) || isNaN(startMinute) || isNaN(endMinute)) return 0;
    const duration = (endHour + endMinute / 60) - (startHour + startMinute / 60);
    return duration > 0 ? duration : 0;
};

// --- Child Components ---
function ShiftRow({ 
    shift, 
    actuals,
    onChange,
    onSave, 
    isAdmin, 
    onDelete,
    isHolidayRequest,
    isChecked,
    onCheck,
    onDeleteActual
}: { 
    shift: Shift, 
    actuals: { actual_start_time: string; actual_end_time: string; break_hours: number; } | undefined,
    onChange: (shiftId: number, field: 'actual_start_time' | 'actual_end_time' | 'break_hours', value: string | number) => void,
    onSave: (shiftId: number) => Promise<void>,
    isAdmin: boolean,
    onDelete: (shiftId: number) => Promise<void>,
    isHolidayRequest?: boolean,
    isChecked: boolean,
    onCheck: (shiftId: number, checked: boolean) => void,
    onDeleteActual?: (shiftId: number) => Promise<void>
}) {
    const actualStart = actuals?.actual_start_time || '';
    const actualEnd = actuals?.actual_end_time || '';
    const breakHours = actuals?.break_hours ?? 1;

    const canEdit = isPast(parseISO(shift.date)) || isAdmin; // 管理者は常に編集可能
    const isSaved = !!shift.actual_id;
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][getDay(parseISO(shift.date))];

    const workDuration = calculateDuration(actualStart, actualEnd) - breakHours;

    const handleTimeChange = (part: 'start' | 'end', newTime: string) => {
        onChange(shift.id, part === 'start' ? 'actual_start_time' : 'actual_end_time', newTime);
    };

    const handleSave = (e: FormEvent) => {
        e.preventDefault();
        onSave(shift.id);
    };

    return (
        <li className={`p-4 bg-white rounded-lg shadow-md ${isSaved ? 'bg-green-50' : ''}`}>
            <div className="flex items-center w-full mb-3">
                <input 
                    type="checkbox" 
                    checked={isChecked} 
                    onChange={(e) => onCheck(shift.id, e.target.checked)} 
                    className="w-5 h-5 mr-4 cursor-pointer"
                />
                <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-3">
                        <p className="text-lg font-bold">{format(parseISO(shift.date), 'M月d日')} ({dayOfWeek})</p>
                        {isHolidayRequest && <span className="text-xs font-bold text-red-500 bg-red-100 px-2 py-1 rounded">休み希望</span>}
                        {isAdmin && (
                            <button
                                type="button"
                                onClick={() => onDelete(shift.id)}
                                className="py-1 px-2.5 bg-red-50 text-red-600 border border-red-200 rounded text-xs font-semibold hover:bg-red-100 transition-colors"
                            >
                                シフト予定を削除
                            </button>
                        )}
                    </div>
                    <p className="text-sm text-gray-600">予定: {shift.start_time?.substring(0, 5) || ''} - {shift.end_time?.substring(0, 5) || ''}</p>
                </div>
            </div>
            <form onSubmit={handleSave} className="flex flex-wrap justify-center items-end gap-4 w-full pl-9">
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
                        onChange={(e) => onChange(shift.id, 'break_hours', parseFloat(e.target.value) || 0)}
                        className="form-input w-20 text-center"
                        disabled={!canEdit}
                    />
                </div>
                <div className="text-center">
                    <p className="text-xs font-medium text-gray-700">勤務時間</p>
                    <p className="font-bold text-lg">{workDuration > 0 ? workDuration.toFixed(2) : '0.00'} h</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                    <button type="submit" className={`py-2 px-4 rounded text-white font-semibold ${isSaved ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'} disabled:bg-gray-300`} disabled={!canEdit}>
                        保存
                    </button>
                    {isSaved && (
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-green-700 font-bold mb-1">保存済</span>
                            {onDeleteActual && (
                                <button type="button" onClick={() => onDeleteActual(shift.id)} className="text-xs text-red-500 hover:text-red-700 underline">
                                    保存解除
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </form>
        </li>
    );
}

function AddShiftRow({ day, employeeId, onSave, defaultHours, isHolidayRequest }: { day: Date, employeeId: string, onSave: () => Promise<void>, defaultHours?: string | null, isHolidayRequest?: boolean }) {
    const formatTime = (t?: string) => {
        if (!t) return '';
        const [h, m] = t.split(':');
        if (h && m) return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
        return t;
    };

    const defaultStart = defaultHours ? formatTime(defaultHours.split('-')[0]) : '09:00';
    const defaultEnd = defaultHours ? formatTime(defaultHours.split('-')[1]) : '18:00';

    const [start, setStart] = useState(defaultStart);
    const [end, setEnd] = useState(defaultEnd);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (defaultHours) {
            setStart(formatTime(defaultHours.split('-')[0]));
            setEnd(formatTime(defaultHours.split('-')[1]));
        }
    }, [defaultHours]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const dateStr = format(day, 'yyyy-MM-dd');
            const response = await fetch('/api/shifts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shiftsToSave: [{ employee_id: parseInt(employeeId), date: dateStr, start_time: start, end_time: end }],
                    force: true
                })
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.details || 'シフトの保存に失敗しました。');
            }
            setIsEditing(false);
            await onSave();
        } catch (err) {
            alert(err instanceof Error ? err.message : '保存中にエラーが発生しました。');
        } finally {
            setIsSaving(false);
        }
    };

    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][getDay(day)];

    return (
        <li className="p-4 bg-gray-50 rounded-lg shadow-sm border border-dashed border-gray-300">
            <div className="flex justify-between items-center w-full">
                <div>
                    <span className="text-lg font-bold text-gray-400">{format(day, 'M月d日')} ({dayOfWeek})</span>
                    <span className="ml-3 text-sm text-gray-400 font-normal">予定なし</span>
                    {isHolidayRequest && <span className="ml-2 text-xs font-bold text-red-500 bg-red-100 px-2 py-1 rounded">休み希望あり</span>}
                </div>
                {!isEditing ? (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="py-1 px-3 bg-blue-50 text-blue-600 border border-blue-200 rounded text-sm font-semibold hover:bg-blue-100 transition-colors"
                    >
                        シフト予定を追加
                    </button>
                ) : (
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                            <input
                                type="time"
                                value={start}
                                onChange={(e) => setStart(e.target.value)}
                                className="form-input text-center py-1 px-2 border rounded"
                            />
                            <span className="text-gray-500">-</span>
                            <input
                                type="time"
                                value={end}
                                onChange={(e) => setEnd(e.target.value)}
                                className="form-input text-center py-1 px-2 border rounded"
                            />
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="py-1 px-3 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-semibold transition-colors"
                        >
                            {isSaving ? '保存中...' : '保存'}
                        </button>
                        <button
                            onClick={() => setIsEditing(false)}
                            className="py-1 px-3 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded text-sm font-semibold transition-colors"
                        >
                            キャンセル
                        </button>
                    </div>
                )}
            </div>
        </li>
    );
}

// --- Main Component ---
export default function MySchedulePage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params.employeeId as string;

  const [currentDate, setCurrentDate] = useState(getInitialDateForPayPeriod());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [requests, setRequests] = useState<ShiftRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 一括保存用ステート
  const [actualsState, setActualsState] = useState<Record<number, { actual_start_time: string; actual_end_time: string; break_hours: number; }>>({});
  const [selectedActuals, setSelectedActuals] = useState<Set<number>>(new Set());
  const [isSavingAll, setIsSavingAll] = useState(false);

  const days = useMemo(() => {
      const { start, end } = getPayPeriodInterval(currentDate);
      return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const renderedItems = useMemo(() => {
      const items = days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const shift = shifts.find(s => s.date.substring(0, 10) === dateStr);
          const hasShift = shift && shift.start_time;
          return { day, dateStr, shift, hasShift };
      });

      if (loggedInUser?.isAdmin) {
          return items;
      }

      const employeeItems = items.filter(item => item.hasShift);
      employeeItems.sort((a, b) => {
          const aSaved = !!a.shift?.actual_id;
          const bSaved = !!b.shift?.actual_id;
          if (aSaved === bSaved) {
              return a.day.getTime() - b.day.getTime();
          }
          return aSaved ? 1 : -1;
      });
      return employeeItems;
  }, [days, shifts, loggedInUser]);

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser) {
      setLoggedInUser(JSON.parse(storedUser));
    }
  }, []);

  useEffect(() => {
    const fetchEmployeesList = async () => {
      try {
        const res = await fetch('/api/employees');
        if (res.ok) {
          const data = await res.json();
          setEmployeesList(data);
        }
      } catch (err) {
        console.error('Failed to fetch employees list', err);
      }
    };
    if (loggedInUser?.isAdmin) {
      fetchEmployeesList();
    }
  }, [loggedInUser]);

  const fetchMySchedule = useCallback(async () => {
        if (!employeeId || employeeId === 'undefined') {
            const storedUser = localStorage.getItem('loggedInUser');
            const loggedIn = storedUser ? JSON.parse(storedUser) : null;
            if (loggedIn?.isAdmin) {
                setIsLoading(true);
                try {
                    const listRes = await fetch('/api/employees');
                    if (listRes.ok) {
                        const listData = await listRes.json();
                        if (listData.length > 0) {
                            router.replace(`/my-schedule/${listData[0].id}`);
                            return;
                        }
                    }
                } catch (err) {
                    console.error(err);
                }
            }
            setError('無効な従業員IDです。');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const empResponse = await fetch(`/api/employees/${employeeId}`);
            if (!empResponse.ok) {
                // 管理者の場合は従業員テーブルにレコードがないため、全従業員リストの先頭の従業員にリダイレクトする
                const storedUser = localStorage.getItem('loggedInUser');
                const loggedIn = storedUser ? JSON.parse(storedUser) : null;
                if (loggedIn?.isAdmin) {
                    const listRes = await fetch('/api/employees');
                    if (listRes.ok) {
                        const listData = await listRes.json();
                        if (listData.length > 0) {
                            router.replace(`/my-schedule/${listData[0].id}`);
                            return;
                        }
                    }
                }
                throw new Error('従業員情報の取得に失敗しました。');
            }
            const empData: Employee = await empResponse.json();
            setEmployee(empData);

            const { start, end } = getPayPeriodInterval(currentDate);
            const startDateStr = format(start, 'yyyy-MM-dd');
            const endDateStr = format(end, 'yyyy-MM-dd');

            const shiftResponse = await fetch(`/api/shifts?employeeId=${employeeId}&startDate=${startDateStr}&endDate=${endDateStr}`);
            if (!shiftResponse.ok) throw new Error('シフトの取得に失敗しました。');
            const shiftData: Shift[] = await shiftResponse.json();
            
            const reqResponse = await fetch(`/api/shift-requests?employeeId=${employeeId}&startDate=${startDateStr}&endDate=${endDateStr}`);
            if (!reqResponse.ok) throw new Error('休み希望の取得に失敗しました。');
            const reqData: ShiftRequest[] = await reqResponse.json();
            
            setShifts(shiftData);
            setRequests(reqData);
            
            // 実績の表示用初期データをセット
            const initialActuals: Record<number, { actual_start_time: string; actual_end_time: string; break_hours: number; }> = {};
            shiftData.forEach(s => {
                initialActuals[s.id] = {
                    actual_start_time: s.actual_start_time?.substring(0, 5) || s.start_time?.substring(0, 5) || '',
                    actual_end_time: s.actual_end_time?.substring(0, 5) || s.end_time?.substring(0, 5) || '',
                    break_hours: s.break_hours ?? 1
                };
            });
            setActualsState(initialActuals);
            setSelectedActuals(new Set());

        } catch (err) {
            setError(err instanceof Error ? err.message : '不明なエラーが発生しました。');
        } finally {
            setIsLoading(false);
        }
  }, [employeeId, currentDate, router]);

  useEffect(() => {
    if (employeeId) {
      fetchMySchedule();
    }
  }, [employeeId, currentDate, fetchMySchedule]);

  const handleActualsChange = (shiftId: number, field: 'actual_start_time' | 'actual_end_time' | 'break_hours', value: string | number) => {
    setActualsState(prev => ({
        ...prev,
        [shiftId]: {
            ...prev[shiftId],
            [field]: value
        }
    }));
    // 編集されたら自動でチェックを入れる
    setSelectedActuals(prev => {
        const next = new Set(prev);
        next.add(shiftId);
        return next;
    });
  };

  const handleSaveActuals = async (shiftId: number) => {
    const data = actualsState[shiftId];
    if (!data) return;
    try {
        const response = await fetch('/api/actuals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                shift_id: shiftId, 
                actual_start_time: data.actual_start_time, 
                actual_end_time: data.actual_end_time, 
                break_hours: data.break_hours 
            }),
        });
        if (!response.ok) throw new Error('実績の保存に失敗しました。');
        alert('勤務実績を保存しました。');
        await fetchMySchedule();
    } catch (err) {
        alert(err instanceof Error ? err.message : 'エラーが発生しました。');
    }
  };

  const handleDeleteActual = async (shiftId: number) => {
      if (!window.confirm('この日の勤務実績（保存済データ）を削除しますか？\n※シフト予定自体は残ります。')) return;
      try {
          const response = await fetch('/api/actuals', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ shift_id: shiftId })
          });
          if (!response.ok) throw new Error('実績の削除に失敗しました。');
          await fetchMySchedule();
      } catch (err) {
          alert(err instanceof Error ? err.message : '削除中にエラーが発生しました。');
      }
  };

  const handleToggleSelectAll = () => {
      if (selectedActuals.size > 0) {
          setSelectedActuals(new Set());
      } else {
          const allIds = shifts.filter(s => s.start_time).map(s => s.id);
          setSelectedActuals(new Set(allIds));
      }
  };

  const handleSaveAllActuals = async () => {
    const actualsToSave: { shift_id: number; actual_start_time: string; actual_end_time: string; break_hours: number; }[] = [];
    
    selectedActuals.forEach(shiftId => {
        const curr = actualsState[shiftId];
        const shift = shifts.find(s => s.id === shiftId);
        if (shift && curr && shift.start_time) {
            actualsToSave.push({
                shift_id: shiftId,
                actual_start_time: curr.actual_start_time,
                actual_end_time: curr.actual_end_time,
                break_hours: curr.break_hours
            });
        }
    });

    if (actualsToSave.length === 0) {
        alert('保存する実績が選択されていません。チェックボックスで選択してください。');
        return;
    }

    if (!window.confirm(`選択された ${actualsToSave.length} 件の実績を一括保存（確定）しますか？`)) {
        return;
    }

    setIsSavingAll(true);
    try {
        const response = await fetch('/api/actuals/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actualsToSave })
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.details || '実績の一括保存に失敗しました。');
        }
        const resData = await response.json();
        alert(`${resData.count}件の実績を保存・確定しました。`);
        await fetchMySchedule();
    } catch (err) {
        alert(err instanceof Error ? err.message : '一括保存中にエラーが発生しました。');
    } finally {
        setIsSavingAll(false);
    }
  };

  const handleDeleteShift = async (shiftId: number) => {
      const shift = shifts.find(s => s.id === shiftId);
      if (!shift) return;

      const hasActual = !!shift.actual_id;
      let confirmMsg = 'この日のシフト予定を削除しますか？';
      if (hasActual) {
          confirmMsg = 'すでに勤務実績が入力されています。シフト予定と実績の両方を削除しますか？';
      }

      if (!window.confirm(confirmMsg)) return;

      try {
          const response = await fetch('/api/shifts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  shiftsToSave: [{ employee_id: parseInt(employeeId), date: shift.date.substring(0, 10), start_time: '', end_time: '' }],
                  force: true
              })
          });
          if (!response.ok) {
              const errData = await response.json();
              throw new Error(errData.details || 'シフトの削除に失敗しました。');
          }
          alert('シフト予定を削除しました。');
          await fetchMySchedule();
      } catch (err) {
          alert(err instanceof Error ? err.message : '削除中にエラーが発生しました。');
      }
  };

  if (isLoading) return <p className="p-4 text-center">読み込み中...</p>;
  if (error) return <p className="p-4 text-center text-red-500">{error}</p>;

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      {loggedInUser?.isAdmin && (
        <div className="sticky top-16 z-10 py-4 -mt-4 mb-2 bg-gray-50">
          <div className="bg-blue-50 p-4 rounded-lg shadow-md border border-blue-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
            <span className="font-bold text-blue-800 text-sm">管理者モード: </span>
            <select
              value={employeeId}
              onChange={(e) => router.push(`/my-schedule/${e.target.value}`)}
              className="form-select rounded border-gray-300 py-1 px-3 bg-white text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {employeesList.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
            <button
              onClick={handleToggleSelectAll}
              className="ml-3 py-1.5 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded text-xs font-bold shadow-sm transition-colors"
            >
              {selectedActuals.size > 0 ? '全選択を解除' : 'すべて選択'}
            </button>
            <button
              onClick={handleSaveAllActuals}
              disabled={isSavingAll || shifts.filter(s => s.start_time).length === 0}
              className="ml-3 py-1.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold shadow-sm transition-colors disabled:bg-gray-400"
            >
              {isSavingAll ? '保存中...' : '実績を一括保存する'}
            </button>
          </div>
          <Link href="/admin/schedule" className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
            ← 管理者画面に戻る
          </Link>
          </div>
        </div>
      )}

      <p className="text-xl mb-6 text-center text-gray-600">{employee?.name} さん</p>

      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="px-4 py-2 bg-gray-200 rounded">前月</button>
        <h2 className="text-xl font-semibold">{format(getPayPeriodInterval(currentDate).start, 'M/d')} - {format(getPayPeriodInterval(currentDate).end, 'M/d')}</h2>
        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="px-4 py-2 bg-gray-200 rounded">次月</button>
      </div>

      <ul className="space-y-4">
        {renderedItems.map(({ day, dateStr, shift, hasShift }) => {
            const isHolidayRequest = requests.some(r => r.date.substring(0, 10) === dateStr && r.request_type === 'holiday');
            
            if (hasShift && shift) {
                return (
                    <ShiftRow 
                        key={shift.id} 
                        shift={shift} 
                        actuals={actualsState[shift.id]}
                        onChange={handleActualsChange}
                        onSave={handleSaveActuals} 
                        isAdmin={!!loggedInUser?.isAdmin}
                        onDelete={handleDeleteShift}
                        isHolidayRequest={isHolidayRequest}
                        isChecked={selectedActuals.has(shift.id)}
                        onCheck={(id, checked) => {
                            setSelectedActuals(prev => {
                                const next = new Set(prev);
                                if (checked) next.add(id);
                                else next.delete(id);
                                return next;
                            });
                        }}
                        onDeleteActual={handleDeleteActual}
                    />
                );
            } else if (loggedInUser?.isAdmin) {
                return (
                    <AddShiftRow
                        key={dateStr}
                        day={day}
                        employeeId={employeeId}
                        onSave={fetchMySchedule}
                        defaultHours={employee?.default_work_hours}
                        isHolidayRequest={isHolidayRequest}
                    />
                );
            }
            return null;
        })}
        {!loggedInUser?.isAdmin && shifts.filter(s => s.start_time).length === 0 && (
            <p className="text-center bg-white p-6 rounded-lg shadow-md text-gray-500">この期間のシフトはありません。</p>
        )}
      </ul>
    </div>
  );
}
