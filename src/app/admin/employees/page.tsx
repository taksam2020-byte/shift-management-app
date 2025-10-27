'use client';

import { useState, useEffect, FormEvent } from 'react';

// --- Type Definitions ---
interface Employee {
  id: number;
  name: string;
  hourly_wage: number;
  request_type: 'holiday' | 'work';
  group_name?: string | null;
  max_weekly_hours?: number | null;
  max_weekly_days?: number | null;
  annual_income_limit?: number | null;
  default_work_hours?: string | null;
  initial_income?: number | null;
  initial_income_year?: number | null;
  hire_date?: string | null;
}

const initialFormState = {
  id: '' as number | '', // Allow empty string for initial state, but treat as number
  name: '',
  hourly_wage: '',
  password: '',
  group_name: '',
  max_weekly_hours: '',
  max_weekly_days: '',
  annual_income_limit: '',
  default_work_hours: '',
  request_type: 'holiday' as 'holiday' | 'work',
  initial_income: '',
  initial_income_year: new Date().getFullYear().toString(),
  hire_date: '',
};

export default function ManageEmployeesPage() {
  // --- State ---
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [formState, setFormState] = useState(initialFormState);
  const [isEditing, setIsEditing] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Data Fetching ---
  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/employees');
      if (!response.ok) throw new Error('データの取得に失敗しました。');
      const data = await response.json();
      setEmployees(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  // --- Event Handlers ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectEmployee = (emp: Employee) => {
    setFormState({
      id: emp.id,
      name: emp.name,
      hourly_wage: String(emp.hourly_wage),
      password: '',
      group_name: emp.group_name || '',
      max_weekly_hours: String(emp.max_weekly_hours || ''),
      max_weekly_days: String(emp.max_weekly_days || ''),
      annual_income_limit: String(emp.annual_income_limit || ''),
      default_work_hours: emp.default_work_hours || '',
      request_type: emp.request_type || 'holiday',
      initial_income: String(emp.initial_income || ''),
      initial_income_year: String(emp.initial_income_year || new Date().getFullYear()),
      hire_date: emp.hire_date ? emp.hire_date.substring(0, 10) : '',
    });
    setIsEditing(true);
  };

  const clearForm = () => {
    setFormState(initialFormState);
    setIsEditing(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const employeeData: Partial<Employee> & { password?: string } = {
        id: Number(formState.id),
        name: formState.name,
        hourly_wage: Number(formState.hourly_wage),
        group_name: formState.group_name || null,
        max_weekly_hours: formState.max_weekly_hours ? Number(formState.max_weekly_hours) : null,
        max_weekly_days: formState.max_weekly_days ? Number(formState.max_weekly_days) : null,
        annual_income_limit: formState.annual_income_limit ? Number(formState.annual_income_limit) : null,
        default_work_hours: formState.default_work_hours || null,
        request_type: formState.request_type,
        initial_income: formState.initial_income ? Number(formState.initial_income) : null,
        initial_income_year: formState.initial_income_year ? Number(formState.initial_income_year) : null,
        hire_date: formState.hire_date || null,
        password: formState.password || undefined,
    };

    if (!employeeData.password) {
        delete employeeData.password;
    }

    const url = isEditing ? `/api/employees/${formState.id}` : '/api/employees';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employeeData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '保存に失敗しました。');
      }
      
      clearForm();
      fetchEmployees();

    } catch (err) {
      setError(err instanceof Error ? err.message : '送信中にエラーが発生しました。');
    }
  };

  const handleDelete = async (employeeId: number) => {
    if (!window.confirm('この従業員を本当に削除しますか？関連するシフト等もすべて削除され、元に戻せません。')) {
        return;
    }
    setError(null);

    try {
        const response = await fetch(`/api/employees/${employeeId}`, { method: 'DELETE' });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '削除に失敗しました。');
        }
        fetchEmployees();
    } catch (err) {
        setError(err instanceof Error ? err.message : '削除中にエラーが発生しました。');
    }
  };

  // --- Render ---
  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <h2 className="text-xl font-semibold mb-2">{isEditing ? '従業員を編集' : '従業員を追加'}</h2>
          <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-md">
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">従業員ID</label>
              <input type="number" name="id" value={formState.id} onChange={handleInputChange} className="mt-1 w-full form-input disabled:bg-gray-200" required disabled={isEditing} />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">氏名</label>
              <input type="text" name="name" value={formState.name} onChange={handleInputChange} className="mt-1 w-full form-input" required />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">グループ (A, B, Cなど)</label>
              <input type="text" name="group_name" value={formState.group_name} onChange={handleInputChange} className="mt-1 w-full form-input" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">提出区分</label>
              <select name="request_type" value={formState.request_type} onChange={handleInputChange} className="mt-1 w-full form-select">
                <option value="holiday">希望休</option>
                <option value="work">希望出勤</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">時給 (円)</label>
              <input type="number" name="hourly_wage" value={formState.hourly_wage} onChange={handleInputChange} className="mt-1 w-full form-input" required />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">入社日</label>
              <input type="date" name="hire_date" value={formState.hire_date} onChange={handleInputChange} className="mt-1 w-full form-input" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">パスワード</label>
              <input type="password" name="password" value={formState.password} onChange={handleInputChange} className="mt-1 w-full form-input" placeholder={isEditing ? '変更する場合のみ入力' : '初期パスワード'} />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">基本勤務時間 (例: 10:00-17:00)</label>
              <input type="text" name="default_work_hours" value={formState.default_work_hours} onChange={handleInputChange} className="mt-1 w-full form-input" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">週の上限時間 (任意)</label>
              <input type="number" name="max_weekly_hours" value={formState.max_weekly_hours} onChange={handleInputChange} className="mt-1 w-full form-input" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">週の上限日数 (任意)</label>
              <input type="number" name="max_weekly_days" value={formState.max_weekly_days} onChange={handleInputChange} className="mt-1 w-full form-input" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">年収上限 (円, 任意)</label>
              <input type="number" name="annual_income_limit" value={formState.annual_income_limit} onChange={handleInputChange} className="mt-1 w-full form-input" />
            </div>
            <hr className="my-4" />
            <p className="text-sm text-gray-600 mb-2">扶養控除などの計算に利用します。</p>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">今年の初期収入額 (円, 任意)</label>
              <input type="number" name="initial_income" value={formState.initial_income} onChange={handleInputChange} className="mt-1 w-full form-input" placeholder="前職やアプリ導入前の収入"/>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">初期収入額の対象年</label>
              <input type="number" name="initial_income_year" value={formState.initial_income_year} onChange={handleInputChange} className="mt-1 w-full form-input" />
            </div>
            
            <div className="flex gap-2 mt-4">
                <button type="submit" className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600">{isEditing ? '更新' : '追加'}</button>
                {isEditing && <button type="button" onClick={clearForm} className="flex-1 bg-gray-300 py-2 px-4 rounded-md hover:bg-gray-400">クリア</button>}
            </div>
            {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
          </form>
        </div>

        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold mb-2">従業員一覧 (クリックして編集)</h2>
          <div className="bg-white rounded-lg shadow-md overflow-x-auto">
            {isLoading ? <p className="p-4">読み込み中...</p> : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">氏名</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">グループ</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">提出区分</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">週時間</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">週日数</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">基本勤務</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">年収上限</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-gray-100">
                      <td onClick={() => handleSelectEmployee(emp)} className="px-2 py-2 cursor-pointer">{emp.id}</td>
                      <td onClick={() => handleSelectEmployee(emp)} className="px-4 py-2 whitespace-nowrap cursor-pointer">{emp.name}</td>
                      <td onClick={() => handleSelectEmployee(emp)} className="px-4 py-2 whitespace-nowrap cursor-pointer">{emp.group_name || '-'}</td>
                      <td onClick={() => handleSelectEmployee(emp)} className="px-4 py-2 whitespace-nowrap cursor-pointer">{emp.request_type === 'work' ? '希望出勤' : '希望休'}</td>
                      <td onClick={() => handleSelectEmployee(emp)} className="px-4 py-2 whitespace-nowrap cursor-pointer">{emp.max_weekly_hours || '-'}</td>
                      <td onClick={() => handleSelectEmployee(emp)} className="px-4 py-2 whitespace-nowrap cursor-pointer">{emp.max_weekly_days || '-'}</td>
                      <td onClick={() => handleSelectEmployee(emp)} className="px-4 py-2 whitespace-nowrap cursor-pointer">{emp.default_work_hours || '-'}</td>
                      <td onClick={() => handleSelectEmployee(emp)} className="px-4 py-2 whitespace-nowrap cursor-pointer">{emp.annual_income_limit ? `¥${emp.annual_income_limit.toLocaleString()}` : '-'}</td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => handleDelete(emp.id)} className="text-red-600 hover:text-red-800 text-xs">削除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
