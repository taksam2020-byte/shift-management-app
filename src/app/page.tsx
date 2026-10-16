'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function HomePage() {
  const router = useRouter();

  const handleAdminLogin = () => router.push('/admin/login');
  const handleEmployeeLogin = () => router.push('/employee/login');
  const handleViewerLogin = async (password?: string) => {
    const response = await fetch('/api/auth/viewer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      // 閲覧用パスワードが設定されている場合は入力してもらう
      if (data.passwordRequired) {
        const input = window.prompt(password === undefined ? '閲覧用パスワードを入力してください' : 'パスワードが違います。もう一度入力してください');
        if (input !== null) await handleViewerLogin(input);
        return;
      }
      alert(data.error || 'ログインに失敗しました。');
      return;
    }
    localStorage.setItem('loggedInUser', JSON.stringify(data.user));
    router.push('/dashboard');
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-gray-100">
      <div className="w-full max-w-md p-6 sm:p-8 space-y-8 bg-white rounded-xl shadow-lg text-center">
        <div className="inline-block">
            <Image src="/logo.png" alt="Logo" width={96} height={96} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 -mt-2">
          シフトくん
        </h1>
        
        <div className="grid grid-cols-1 gap-6 pt-4">
          <button onClick={handleAdminLogin} className="block w-full text-center px-6 py-4 text-lg font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 transition-transform transform hover:scale-105">
            管理者ログイン
          </button>
          
          <button onClick={handleEmployeeLogin} className="block w-full text-center px-6 py-4 text-lg font-semibold text-white bg-green-600 rounded-lg shadow-md hover:bg-green-700 transition-transform transform hover:scale-105">
            従業員ログイン
          </button>
          <button onClick={() => handleViewerLogin()} className="block w-full text-center px-6 py-4 text-lg font-semibold text-white bg-gray-600 rounded-lg shadow-md hover:bg-gray-700 transition-transform transform hover:scale-105">
            閲覧のみ
          </button>
        </div>
      </div>
    </main>
  );
}