  import Link from 'next/link';

  export default function HomePage() {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-100">
        <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-lg">
          <h1 className="text-3xl font-bold text-center text-gray-900">
            シフト管理システム
          </h1>

          <div className="grid grid-cols-1 gap-6">
            <Link href="/admin/login" className="block w-full text-center px-6 py-4 text-lg font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 transition-transform
  transform hover:scale-105">
              管理者としてログイン
            </Link>

            <Link href="/employee/login" className="block w-full text-center px-6 py-4 text-lg font-semibold text-white bg-green-600 rounded-lg shadow-md hover:bg-green-700
  transition-transform transform hover:scale-105">
              従業員としてログイン
            </Link>
          </div>
        </div>
      </main>
    );
  }
