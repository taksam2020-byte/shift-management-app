'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: number;
  name: string;
  isAdmin: boolean;
  isViewer?: boolean;
  request_type?: 'holiday' | 'work';
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const storedUser = localStorage.getItem('loggedInUser');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        } else {
          router.push('/');
        }
    }
  }, [router]);

  if (!user) {
    return <p>読み込み中...</p>;
  }

  const requestLinkText = user?.request_type === 'work' ? '希望出勤日の提出' : '希望休の提出';
  const requestLinkDesc = user?.request_type === 'work' ? '出勤したい日を提出します。' : '休みたい日を提出します。';

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4">
        ようこそ、{user.name} さん
      </h1>
      <p className="text-lg text-gray-600 mb-8">
        メニューを選択してください。
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Viewer Links */}
        {user.isViewer && (
          <>
            <Link href="/admin/reports/monthly" className="block p-6 bg-gray-700 text-white rounded-lg shadow-md hover:bg-gray-800 transition-colors">
              <h2 className="text-xl font-bold">月間集計</h2>
              <p>勤務実績の集計レポートを確認します。</p>
            </Link>
            <Link href="/admin/reports/cross-period" className="block p-6 bg-gray-700 text-white rounded-lg shadow-md hover:bg-gray-800 transition-colors">
              <h2 className="text-xl font-bold">年間集計</h2>
              <p>複数月度の勤務時間を集計・比較します。</p>
            </Link>
            <Link href="/schedule/view" className="block p-6 bg-gray-700 text-white rounded-lg shadow-md hover:bg-gray-800 transition-colors">
              <h2 className="text-xl font-bold">全体シフト確認</h2>
              <p>全員のシフトを閲覧します。</p>
            </Link>
          </>
        )}

        {/* Admin Links */}
        {user.isAdmin && !user.isViewer && (
          <>
            <Link href="/admin/schedule" className="block p-6 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors">
              <h2 className="text-xl font-bold">シフト作成</h2>
              <p>全体のシフト表を作成・編集します。</p>
            </Link>
            <Link href="/admin/employees" className="block p-6 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors">
              <h2 className="text-xl font-bold">従業員管理</h2>
              <p>従業員の登録や編集を行います。</p>
            </Link>
            <Link href="/admin/reports/monthly" className="block p-6 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors">
              <h2 className="text-xl font-bold">月間集計</h2>
              <p>勤務実績の集計レポートを確認します。</p>
            </Link>
            <Link href="/admin/reports/cross-period" className="block p-6 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors">
              <h2 className="text-xl font-bold">年間集計</h2>
              <p>複数月度の勤務時間を集計・比較します。</p>
            </Link>
            <Link href="/admin/holidays" className="block p-6 bg-gray-700 text-white rounded-lg shadow-md hover:bg-gray-800 transition-colors">
              <h2 className="text-xl font-bold">休業日設定</h2>
              <p>会社独自の休日を設定します。</p>
            </Link>
            <Link href="/schedule/view" className="block p-6 bg-gray-700 text-white rounded-lg shadow-md hover:bg-gray-800 transition-colors">
              <h2 className="text-xl font-bold">全体シフト確認</h2>
              <p>全員のシフトを閲覧します。</p>
            </Link>
          </>
        )}

        {/* Employee Links */}
        {!user.isAdmin && !user.isViewer && (
          <>
            <Link href={`/my-schedule/${user.id}`} className="block p-6 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition-colors">
              <h2 className="text-xl font-bold">マイシフト</h2>
              <p>自分のシフトを確認し、実績を入力します。</p>
            </Link>
            <Link href={`/requests/${user.id}`} className="block p-6 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition-colors">
              <h2 className="text-xl font-bold">{requestLinkText}</h2>
              <p>{requestLinkDesc}</p>
            </Link>
            <Link href="/schedule/view" className="block p-6 bg-gray-700 text-white rounded-lg shadow-md hover:bg-gray-800 transition-colors">
              <h2 className="text-xl font-bold">全体シフト確認</h2>
              <p>全員のシフトを閲覧します。</p>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
