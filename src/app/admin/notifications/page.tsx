'use client';

import { useEffect, useState, FormEvent } from 'react';
import NotificationSettings from '@/components/NotificationSettings';

interface Deadline {
  id: number;
  period_start: string;
  period_end: string;
  deadline: string;
}

const slash = (d: string) => d.replace(/-/g, '/');

export default function NotificationsPage() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchDeadlines = async () => {
    try {
      const res = await fetch('/api/request-deadlines');
      if (!res.ok) throw new Error('締切の取得に失敗しました。');
      setDeadlines(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラー');
    }
  };

  useEffect(() => {
    fetchDeadlines();
  }, []);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/request-deadlines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period_start: periodStart, period_end: periodEnd, deadline }),
    });
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error || '締切の登録に失敗しました。');
      return;
    }
    setPeriodStart('');
    setPeriodEnd('');
    setDeadline('');
    fetchDeadlines();
  };

  const handleDelete = async (d: Deadline) => {
    if (!window.confirm(`${slash(d.period_start)}〜${slash(d.period_end)} の締切を削除しますか？`)) return;
    const res = await fetch(`/api/request-deadlines?id=${d.id}`, { method: 'DELETE' });
    if (!res.ok) alert('締切の削除に失敗しました。');
    fetchDeadlines();
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">通知・締切設定</h1>

      <NotificationSettings isAdmin />

      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md border border-gray-200">
        <h2 className="text-lg font-bold text-gray-800 mb-1">希望休・希望出勤日の締切</h2>
        <p className="text-sm text-gray-600 mb-4">
          締切の3日前と前日に、対象期間の希望を1日も出していない従業員へスマホ通知が届きます（朝9時ごろ）。
          締切は従業員の希望提出画面にも表示されます。
        </p>
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <label className="text-sm text-gray-700">
            対象期間（開始）
            <input type="date" required value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="mt-1 block w-full border rounded px-2 py-1" />
          </label>
          <label className="text-sm text-gray-700">
            対象期間（終了）
            <input type="date" required value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="mt-1 block w-full border rounded px-2 py-1" />
          </label>
          <label className="text-sm text-gray-700">
            締切日
            <input type="date" required value={deadline} onChange={(e) => setDeadline(e.target.value)} className="mt-1 block w-full border rounded px-2 py-1" />
          </label>
          <button type="submit" className="sm:col-span-3 py-2 px-4 bg-blue-500 text-white font-bold rounded hover:bg-blue-600">締切を追加</button>
        </form>

        {error && <p className="text-red-500 mt-3">{error}</p>}
        <ul className="mt-5 divide-y">
          {deadlines.length === 0 && <li className="py-2 text-sm text-gray-500">まだ締切は登録されていません。</li>}
          {deadlines.map((d) => (
            <li key={d.id} className="py-2 flex items-center justify-between text-sm">
              <span>
                {slash(d.period_start)}〜{slash(d.period_end)} の分 ／ 締切 <span className="font-bold">{slash(d.deadline)}</span>
              </span>
              <button onClick={() => handleDelete(d)} className="text-red-500 hover:text-red-700">削除</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
