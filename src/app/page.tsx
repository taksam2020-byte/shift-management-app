import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
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
          <Link href="/admin/login" className="block w-full text-center px-6 py-4 text-lg font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 transition-transform transform hover:scale-105">
            管理者ログイン
          </Link>
          
          <Link href="/employee/login" className="block w-full text-center px-6 py-4 text-lg font-semibold text-white bg-green-600 rounded-lg shadow-md hover:bg-green-700 transition-transform transform hover:scale-105">
            従業員ログイン
          </Link>
          <Link href="/viewer/login" className="block w-full text-center px-6 py-4 text-lg font-semibold text-white bg-gray-600 rounded-lg shadow-md hover:bg-gray-700 transition-transform transform hover:scale-105">
            閲覧者ログイン
          </Link>
        </div>
      </div>
    </main>
  );
}