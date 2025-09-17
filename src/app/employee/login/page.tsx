'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider'; // Import useAuth

interface Employee {
  id: number;
  name: string;
  request_type: 'holiday' | 'work';
}

export default function EmployeeLoginPage() {
  const { isLoading: isAuthLoading } = useAuth(); // Get auth loading state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); // Use different loading state for form submission
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Only fetch employees if auth is not loading and user is not authenticated
    if (!isAuthLoading) {
      const fetchEmployees = async () => {
        try {
          const response = await fetch('/api/employees');
          if (!response.ok) throw new Error('従業員リストの取得に失敗しました。');
          const data = await response.json();
          setEmployees(data);
          if (data.length > 0) {
            setSelectedEmployeeId(String(data[0].id));
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : '不明なエラー');
        }
      };
      fetchEmployees();
    }
  }, [isAuthLoading]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId || !password) {
        setError('名前とパスワードの両方を入力してください。');
        return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
        const response = await fetch('/api/employee/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId: parseInt(selectedEmployeeId, 10), password, rememberMe }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'ログインに失敗しました。');
        }

        if (data.token) {
            localStorage.setItem('authToken', data.token);
        }
        localStorage.setItem('loggedInUser', JSON.stringify(data.user));
        // Instead of pushing, we reload the page. AuthProvider will handle the redirect.
        window.location.href = '/dashboard';

    } catch (err) {
        setError(err instanceof Error ? err.message : 'ログインエラー');
    } finally {
        setIsSubmitting(false);
    }
  };

  // Render nothing or a minimal loader while AuthProvider is checking
  if (isAuthLoading) {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-gray-50">
      <div className="w-full max-w-md p-6 sm:p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-gray-800">従業員ログイン</h1>
        
        {employees.length === 0 && !error && <p>従業員リストを読み込み中...</p>}
        {error && <p className="text-center text-red-500">{error}</p>}

        {employees.length > 0 && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="employee-select" className="block text-sm font-medium text-gray-700">
                あなたの名前を選択してください
              </label>
              <select
                id="employee-select"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">パスワード</label>
                <input 
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                />
            </div>
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                ログイン状態を維持する
              </label>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400"
            >
              {isSubmitting ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}