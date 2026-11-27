'use client';

import { useState, useEffect, useMemo, FormEvent } from 'react';
import { format, parseISO } from 'date-fns';

interface CompanyHoliday {
  date: string;
  note?: string;
  name?: string;
}

// 表示の区切りは暦年（1月1日〜12月31日）
const getYear = (d: Date) => d.getFullYear();

export default function ManageHolidaysPage() {
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayNote, setNewHolidayNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(() => getYear(new Date()));

  // 選べる年: 登録済みの休業日がある年 + 今年
  const years = useMemo(() => {
    const years = new Set<number>([getYear(new Date()), selectedYear]);
    holidays.forEach((h) => years.add(getYear(parseISO(h.date))));
    return Array.from(years).sort((a, b) => b - a);
  }, [holidays, selectedYear]);

  // 選択中の年の休業日を新しい順に並べる
  const visibleHolidays = useMemo(
    () =>
      holidays
        .filter((h) => getYear(parseISO(h.date)) === selectedYear)
        .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()),
    [holidays, selectedYear]
  );

  const fetchHolidays = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/company-holidays');
      if (!response.ok) throw new Error('休日の取得に失敗しました。');
      const data = await response.json();
      setHolidays(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラー');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const handleAddHoliday = async (e: FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate) return;
    try {
      const response = await fetch('/api/company-holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: newHolidayDate, note: newHolidayNote }),
      });
      if (!response.ok) throw new Error('休日の追加に失敗しました。');
      // 追加した日の年を表示して、追加結果がすぐ見えるようにする
      setSelectedYear(getYear(parseISO(newHolidayDate)));
      setNewHolidayDate('');
      setNewHolidayNote('');
      fetchHolidays(); // Refresh list
    } catch (err) {
      alert(err instanceof Error ? err.message : 'エラー');
    }
  };

  const handleDeleteHoliday = async (date: string) => {
    if (!window.confirm(`${date} を休日設定から削除しますか？`)) return;
    try {
      const response = await fetch(`/api/company-holidays?date=${date}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('休日の削除に失敗しました。');
      fetchHolidays(); // Refresh list
    } catch (err) {
      alert(err instanceof Error ? err.message : 'エラー');
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      
      
      {/* Add Holiday Form */}
      <form onSubmit={handleAddHoliday} className="bg-white p-4 rounded-lg shadow-md mb-6 flex items-end gap-4">
        <div className="flex-grow">
          <label htmlFor="holiday-date" className="block text-sm font-medium text-gray-700">日付</label>
          <input
            type="date"
            id="holiday-date"
            value={newHolidayDate}
            onChange={(e) => setNewHolidayDate(e.target.value)}
            className="mt-1 block w-full form-input"
            required
          />
        </div>
        <div className="flex-grow">
          <label htmlFor="holiday-note" className="block text-sm font-medium text-gray-700">名称 (任意)</label>
          <input
            type="text"
            id="holiday-note"
            value={newHolidayNote}
            onChange={(e) => setNewHolidayNote(e.target.value)}
            className="mt-1 block w-full form-input"
          />
        </div>
        <button type="submit" className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600">追加</button>
      </form>

      {/* Holiday List */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">設定済み休業日一覧 <span title="土日祝以外の会社の休日を設定します。ここで設定した日はシフト作成画面で全員が自動的に「休み」になります。" className="text-gray-400 cursor-help font-normal text-sm">ⓘ</span></h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedYear((y) => y - 1)}
              className="px-2 py-1 rounded border text-gray-700 hover:bg-gray-100"
              aria-label="前の年"
            >
              ◀
            </button>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="border rounded px-2 py-1"
              aria-label="表示する年"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}年
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSelectedYear((y) => y + 1)}
              className="px-2 py-1 rounded border text-gray-700 hover:bg-gray-100"
              aria-label="次の年"
            >
              ▶
            </button>
          </div>
        </div>
        {isLoading && <p className="p-4">読み込み中...</p>}
        {error && <p className="p-4 text-red-500">{error}</p>}
        <ul className="divide-y divide-gray-200">
          {visibleHolidays.length > 0 ? visibleHolidays.map((holiday) => (
            <li key={holiday.date} className="p-4 flex justify-between items-center">
              <div>
                <p className="font-semibold">{format(parseISO(holiday.date), 'yyyy年 M月 d日 (E)')}</p>
                {(holiday.name ?? holiday.note) && <p className="text-sm text-gray-600">{holiday.name ?? holiday.note}</p>}
              </div>
              <button onClick={() => handleDeleteHoliday(holiday.date)} className="text-red-600 hover:text-red-800 text-sm font-semibold">削除</button>
            </li>
          )) : (
            <li className="p-4 text-gray-500">{selectedYear}年の休業日はありません。</li>
          )}
        </ul>
      </div>
    </div>
  );
}
