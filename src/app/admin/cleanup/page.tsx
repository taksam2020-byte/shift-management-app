'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';

interface UnenteredShift {
  shift_id: number;
  date: string;
  start_time: string;
  end_time: string;
  employee_name: string;
  employee_id: number;
}

export default function CleanupPage() {
  const [shifts, setShifts] = useState<UnenteredShift[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // ログイン状態・管理者権限チェック
    const storedUser = localStorage.getItem('loggedInUser');
    const loggedIn = storedUser ? JSON.parse(storedUser) : null;
    if (!loggedIn || !loggedIn.isAdmin) {
      router.push('/');
      return;
    }
    fetchUnenteredShifts();
  }, [router]);

  const fetchUnenteredShifts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/shifts/unentered');
      if (!res.ok) throw new Error('未入力シフトの取得に失敗しました。');
      const data: UnenteredShift[] = await res.json();
      setShifts(data);
      setSelectedIds(new Set()); // リセット
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラー');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === shifts.length && shifts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(shifts.map(s => s.shift_id)));
    }
  };

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`選択した ${selectedIds.size} 件のシフト予定を削除します。よろしいですか？`)) return;

    setIsDeleting(true);
    try {
      const res = await fetch('/api/shifts/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftIds: Array.from(selectedIds) })
      });
      if (!res.ok) throw new Error('削除処理に失敗しました。');
      
      alert(`${selectedIds.size} 件のシフトを削除しました。`);
      await fetchUnenteredShifts();
    } catch (err) {
      alert(err instanceof Error ? err.message : '削除中にエラーが発生しました。');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) return <p className="p-6 text-center text-gray-600">読み込み中...</p>;

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">未入力シフトの整理（クリーンアップ） <span title="予定されていたのに実績が入力されず放置されている過去のシフトを一括削除し、年間上限の計算ズレを防ぐ機能です。" className="text-gray-400 cursor-help font-normal text-lg">ⓘ</span></h1>
        <Link href="/dashboard" className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
          ← ダッシュボードへ戻る
        </Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <p className="text-gray-600 mb-6 leading-relaxed">
          今日より前の日付で、実績が未入力（または打刻漏れ）になっているシフトの一覧です。<br/>
          急な欠勤などで出勤しなかったシフト予定が残っていると、今後の残日数（年間上限）の計算にズレが生じます。不要なシフトはここで一括削除してください。
        </p>

        {error && <p className="text-red-500 mb-4 font-semibold">{error}</p>}

        {shifts.length === 0 ? (
          <div className="bg-green-50 border border-green-200 text-green-700 p-8 rounded-lg text-center">
            <span className="text-2xl block mb-2">🎉</span>
            <p className="font-bold text-lg">未入力の過去シフトはありません！</p>
            <p className="text-sm mt-1">すべての実績が正しく処理されています。</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3 bg-gray-50 p-3 rounded border border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-700">
                <input 
                  type="checkbox" 
                  checked={selectedIds.size === shifts.length && shifts.length > 0} 
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                すべて選択
              </label>
              <button 
                onClick={handleDelete}
                disabled={selectedIds.size === 0 || isDeleting}
                className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded font-bold transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed shadow-sm"
              >
                {isDeleting ? '削除中...' : `選択したシフトを削除 (${selectedIds.size})`}
              </button>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="w-12 px-4 py-3 text-center"></th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">日付</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">従業員</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">予定時間</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {shifts.map(shift => {
                    const isSelected = selectedIds.has(shift.shift_id);
                    return (
                      <tr key={shift.shift_id} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                        <td className="px-4 py-3 text-center">
                          <input 
                            type="checkbox" 
                            checked={isSelected} 
                            onChange={() => toggleSelect(shift.shift_id)}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                          {format(parseISO(shift.date), 'yyyy年M月d日')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {shift.employee_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
