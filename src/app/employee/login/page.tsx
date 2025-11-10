'use client';

import { useState, useEffect, FormEvent, useRef } from 'react';
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
  const [isSubmitting, setIsSubmitting] = useState(false); // Use different loading state for form submission
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the password field when the component mounts and employees are loaded
    if (employees.length > 0) {
      passwordRef.current?.focus();
    }
  }, [employees]);

  useEffect(() => {
    // Only fetch employees if auth is not loading and user is not authenticated
    if (!isAuthLoading) {
...
            <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">パスワード</label>
                <input 
                    type="password"
                    id="password"
                    ref={passwordRef}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                />
            </div>
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
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
