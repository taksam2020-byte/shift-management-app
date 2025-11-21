'use client';

import { useRouter } from 'next/navigation';

export default function ViewerLoginPage() {
  const router = useRouter();

  const handleViewerLogin = () => {
    const viewerUser = { id: 0, name: '閲覧者', isAdmin: false, isViewer: true };
    localStorage.setItem('loggedInUser', JSON.stringify(viewerUser));
    router.push('/dashboard');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-lg shadow-md text-center">
        <h1 className="text-xl font-bold text-gray-800">閲覧用ページ</h1>
        <p className="text-gray-600">
          下のボタンを押すと、シフトの閲覧を開始します。
        </p>
        <button
          onClick={handleViewerLogin}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
        >
          閲覧を開始する
        </button>
      </div>
    </div>
  );
}