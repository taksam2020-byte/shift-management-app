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
  is_active?: boolean;
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
  is_active: true,
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
      const response = await fetch('/api/employees?include_inactive=true');
      if (!response.ok) throw new Error('繝・・繧ｿ縺ｮ蜿門ｾ励↓螟ｱ謨励＠縺ｾ縺励◆縲・);
      const data = await response.json();
      setEmployees(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '荳肴・縺ｪ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆縲・);
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
    if (name === 'is_active') {
        setFormState(prev => ({ ...prev, [name]: value === 'true' }));
    } else {
        setFormState(prev => ({ ...prev, [name]: value }));
    }
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
      is_active: emp.is_active !== false,
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
        is_active: formState.is_active,
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
        throw new Error(errorData.error || '菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆縲・);
      }
      
      clearForm();
      fetchEmployees();

    } catch (err) {
      setError(err instanceof Error ? err.message : '騾∽ｿ｡荳ｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆縲・);
    }
  };

  const handleDelete = async (employeeId: number) => {
    if (!window.confirm('縺薙・蠕捺･ｭ蜩｡繧呈悽蠖薙↓蜑企勁縺励∪縺吶°・滄未騾｣縺吶ｋ繧ｷ繝輔ヨ遲峨ｂ縺吶∋縺ｦ蜑企勁縺輔ｌ縲∝・縺ｫ謌ｻ縺帙∪縺帙ｓ縲・)) {
        return;
    }
    setError(null);

    try {
        const response = await fetch(`/api/employees/${employeeId}`, { method: 'DELETE' });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '蜑企勁縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲・);
        }
        fetchEmployees();
    } catch (err) {
        setError(err instanceof Error ? err.message : '蜑企勁荳ｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆縲・);
    }
  };

  // --- Render ---
  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <h2 className="text-xl font-semibold mb-2">{isEditing ? '蠕捺･ｭ蜩｡繧堤ｷｨ髮・ : '蠕捺･ｭ蜩｡繧定ｿｽ蜉�'}</h2>
          <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-md">
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700" title="蝓ｺ蟷ｹ繧ｷ繧ｹ繝・Β縺ｨ蜷後§逡ｪ蜿ｷ繧貞・蜉帙＠縺ｦ縺上□縺輔＞縲・>
                蠕捺･ｭ蜩｡ID <span className="text-gray-400 cursor-help">?</span>
              </label>
              <input type="number" name="id" value={formState.id} onChange={handleInputChange} disabled={isEditing} className="mt-1 w-full form-input bg-gray-50" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700" title="驥崎､・′辟｡縺代ｌ縺ｰ蜷榊ｭ励□縺代ｒ蜈･蜉帙＠縺ｦ縺上□縺輔＞縲・>
                豌丞錐 <span className="text-gray-400 cursor-help">?</span>
              </label>
              <input type="text" name="name" value={formState.name} onChange={handleInputChange} className="mt-1 w-full form-input" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700" title="閾ｪ蜍輔す繝輔ヨ菴懈・譎ゅ∝酔縺俶律縺ｫ蜷後§繧ｰ繝ｫ繝ｼ繝励・莠ｺ縺ｰ縺九ｊ縺悟￥繧峨↑縺・ｈ縺・↓・亥挨繧ｰ繝ｫ繝ｼ繝励・莠ｺ繧貞━蜈医＠縺ｦ繝舌Λ繝ｳ繧ｹ濶ｯ縺城・鄂ｮ縺吶ｋ繧医≧縺ｫ・牙・謨｣縺輔○繧九◆繧√・險ｭ螳壹〒縺吶・>
                繧ｰ繝ｫ繝ｼ繝・(莉ｻ諢・ <span className="text-gray-400 cursor-help">?</span>
              </label>
              <select name="group_name" value={formState.group_name} onChange={handleInputChange} className="mt-1 w-full form-select">
                <option value="">(縺ｪ縺・</option>
                {Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).map(char => (
                  <option key={char} value={char}>{char}</option>
                ))}
              </select>
            </div>
            <div className="mb-3 flex gap-4">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700">譎らｵｦ</label>
                    <input type="number" name="hourly_wage" value={formState.hourly_wage} onChange={handleInputChange} className="mt-1 w-full form-input" />
                </div>
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700">謠仙・蛹ｺ蛻・/label>
                    <select name="request_type" value={formState.request_type} onChange={handleInputChange} className="mt-1 w-full form-select">
                        <option value="holiday">蟶梧悍莨代ｒ謠仙・</option>
                        <option value="work">蟶梧悍蜃ｺ蜍､譌･繧呈署蜃ｺ</option>
                    </select>
                </div>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">繝代せ繝ｯ繝ｼ繝・/label>
              <input type="password" name="password" value={formState.password} onChange={handleInputChange} className="mt-1 w-full form-input" placeholder={isEditing ? '螟画峩縺吶ｋ蝣ｴ蜷医・縺ｿ蜈･蜉・ : '蛻晄悄繝代せ繝ｯ繝ｼ繝・} />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">蝓ｺ譛ｬ蜍､蜍呎凾髢・/label>
              <div className="flex items-center mt-1">
                <input 
                  type="time" 
                  value={formState.default_work_hours ? formState.default_work_hours.split('-')[0] : ''}
                  onChange={(e) => {
                    const start = e.target.value;
                    const end = formState.default_work_hours ? formState.default_work_hours.split('-')[1] || '' : '';
                    setFormState(prev => ({...prev, default_work_hours: start || end ? `${start}-${end}` : ''}));
                  }}
                  onFocus={(e) => {
                    if (!formState.default_work_hours) {
                      setFormState(prev => ({...prev, default_work_hours: '10:00-17:00'}));
                    }
                  }}
                  className="form-input w-full" 
                />
                <span className="mx-2">縲・/span>
                <input 
                  type="time" 
                  value={formState.default_work_hours && formState.default_work_hours.includes('-') ? formState.default_work_hours.split('-')[1] : ''}
                  onChange={(e) => {
                    const end = e.target.value;
                    const start = formState.default_work_hours ? formState.default_work_hours.split('-')[0] || '' : '';
                    setFormState(prev => ({...prev, default_work_hours: start || end ? `${start}-${end}` : ''}));
                  }}
                  onFocus={(e) => {
                    if (!formState.default_work_hours) {
                      setFormState(prev => ({...prev, default_work_hours: '10:00-17:00'}));
                    }
                  }}
                  className="form-input w-full" 
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">騾ｱ縺ｮ荳企剞譎る俣 (莉ｻ諢・</label>
              <input type="number" name="max_weekly_hours" value={formState.max_weekly_hours} onChange={handleInputChange} className="mt-1 w-full form-input" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">騾ｱ縺ｮ荳企剞譌･謨ｰ (莉ｻ諢・</label>
              <input type="number" name="max_weekly_days" value={formState.max_weekly_days} onChange={handleInputChange} className="mt-1 w-full form-input" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">蟷ｴ蜿惹ｸ企剞 (莉ｻ諢・</label>
              <input type="number" name="annual_income_limit" value={formState.annual_income_limit} onChange={handleInputChange} className="mt-1 w-full form-input" placeholder="萓・ 1030000" />
            </div>
            <hr className="my-4" />
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700" title="年収上限に収めるためのシミュレーションに利用します。">今年の初期収入額 (円, 任意) <span className="text-gray-400 cursor-help font-normal">ⓘ</span></label>
              <input type="number" name="initial_income" value={formState.initial_income} onChange={handleInputChange} className="mt-1 w-full form-input" placeholder="前職の収入など" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">蛻晄悄蜿主・鬘阪・蟇ｾ雎｡蟷ｴ</label>
              <input type="number" name="initial_income_year" value={formState.initial_income_year} onChange={handleInputChange} className="mt-1 w-full form-input" />
            </div>
            
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700">蝨ｨ邀咲憾豕・/label>
              <select name="is_active" value={String(formState.is_active)} onChange={handleInputChange} className="mt-1 w-full form-select bg-gray-50 border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50">
                <option value="true">蝨ｨ邀堺ｸｭ (譛牙柑)</option>
                <option value="false">騾閨ｷ貂・(髱櫁｡ｨ遉ｺ)</option>
              </select>
            </div>
            
            <div className="flex gap-2 mt-4">
                <button type="submit" className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600">{isEditing ? '譖ｴ譁ｰ' : '霑ｽ蜉�'}</button>
                {isEditing && <button type="button" onClick={clearForm} className="flex-1 bg-gray-300 py-2 px-4 rounded-md hover:bg-gray-400">繧ｯ繝ｪ繧｢</button>}
            </div>
            {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
          </form>
        </div>

        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold mb-2">蠕捺･ｭ蜩｡荳隕ｧ (繧ｯ繝ｪ繝・け縺励※邱ｨ髮・</h2>
          <div className="bg-white rounded-lg shadow-md overflow-x-auto">
            {isLoading ? <p className="p-4">隱ｭ縺ｿ霎ｼ縺ｿ荳ｭ...</p> : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">豌丞錐</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">蝨ｨ邀咲憾豕・/th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">繧ｰ繝ｫ繝ｼ繝・/th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">謠仙・蛹ｺ蛻・/th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">騾ｱ譎る俣</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">騾ｱ譌･謨ｰ</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">蟷ｴ蜿惹ｸ企剞</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {employees.map((emp) => (
                    <tr key={emp.id} className={`hover:bg-gray-100 ${emp.is_active === false ? 'bg-gray-200 text-gray-500' : ''}`}>
                      <td onClick={() => handleSelectEmployee(emp)} className="px-2 py-2 cursor-pointer">{emp.id}</td>
                      <td onClick={() => handleSelectEmployee(emp)} className="px-4 py-2 whitespace-nowrap cursor-pointer">{emp.name}</td>
                      <td onClick={() => handleSelectEmployee(emp)} className="px-4 py-2 whitespace-nowrap cursor-pointer">
                          {emp.is_active === false ? <span className="text-xs bg-gray-400 text-white px-2 py-1 rounded">騾閨ｷ貂・/span> : <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">蝨ｨ邀堺ｸｭ</span>}
                      </td>
                      <td onClick={() => handleSelectEmployee(emp)} className="px-4 py-2 whitespace-nowrap cursor-pointer">{emp.group_name || '-'}</td>
                      <td onClick={() => handleSelectEmployee(emp)} className="px-4 py-2 whitespace-nowrap cursor-pointer">{emp.request_type === 'work' ? '蟶梧悍蜃ｺ蜍､' : '蟶梧悍莨・}</td>
                      <td onClick={() => handleSelectEmployee(emp)} className="px-4 py-2 whitespace-nowrap cursor-pointer">{emp.max_weekly_hours || '-'}</td>
                      <td onClick={() => handleSelectEmployee(emp)} className="px-4 py-2 whitespace-nowrap cursor-pointer">{emp.max_weekly_days || '-'}</td>
                      <td onClick={() => handleSelectEmployee(emp)} className="px-4 py-2 whitespace-nowrap cursor-pointer">{emp.annual_income_limit ? `ﾂ･${emp.annual_income_limit.toLocaleString()}` : '-'}</td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => handleDelete(emp.id)} className="text-red-600 hover:text-red-800 text-xs">蜑企勁</button>
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
