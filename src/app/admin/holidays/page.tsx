'use client';

import { useState, useEffect, useMemo, FormEvent } from 'react';
import { format, parseISO } from 'date-fns';

interface CompanyHoliday {
  date: string;
  note?: string;
  name?: string;
}

// 年度（4月〜翌3月）を返す。例: 2026年3月 → 2025年度、2026年4月 → 2026年度
const getFiscalYear = (d: Date) => (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1);

export default function ManageHolidaysPage() {
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayNote, setNewHolidayNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(() => getFiscalYear(new Date()));

  // 選べる年度: 登録済みの休業日がある年度 + 今年度
  const fiscalYears = useMemo(() => {
    const years = new Set<number>([getFiscalYear(new Date()), selectedFiscalYear]);
    holidays.forEach((h) => years.add(getFiscalYear(parseISO(h.date))));
    return Array.from(years).sort((a, b) => b - a);
  }, [holidays, selectedFiscalYear]);

  // 選択中の年度の休業日を新しい順に並べる
  const visibleHolidays = useMemo(
    () =>
      holidays
        .filter((h) => getFiscalYear(parseISO(h.date)) === selectedFiscalYear)
        .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()),
    [holidays, selectedFiscalYear]
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
      // 追加した日の年度を表示して、追加結果がすぐ見えるようにする
      setSelectedFiscalYear(getFiscalYear(parseISO(newHolidayDate)));
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
              onClick={() => setSelectedFiscalYear((y) => y - 1)}
              className="px-2 py-1 rounded border text-gray-700 hover:bg-gray-100"
              aria-label="前の年度"
            >
              ◀
            </button>
            <select
              value={selectedFiscalYear}
              onChange={(e) => setSelectedFiscalYear(Number(e.target.value))}
              className="border rounded px-2 py-1"
              aria-label="表示する年度"
            >
              {fiscalYears.map((y) => (
                <option key={y} value={y}>
                  {y}年度（{y}/4〜{y + 1}/3）
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSelectedFiscalYear((y) => y + 1)}
              className="px-2 py-1 rounded border text-gray-700 hover:bg-gray-100"
              aria-label="次の年度"
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
            <li className="p-4 text-gray-500">{selectedFiscalYear}年度の休業日はありません。</li>
          )}
        </ul>
      </div>
    </div>
  );
}
