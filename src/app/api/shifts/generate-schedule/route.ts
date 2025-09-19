import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';
import { eachDayOfInterval, format, getDay, startOfWeek, parseISO, subDays, addDays } from 'date-fns';

// --- Types ---
interface Employee {
    id: number;
    name: string;
    group_name: string | null;
    default_work_hours: string | null;
    max_weekly_hours: number | null;
    max_weekly_days: number | null;
}

interface ShiftRequest {
    employee_id: number;
    date: string; // YYYY-MM-DD
    request_type: 'holiday' | 'work';
}

interface Schedule {
    [date: string]: { [employeeId: number]: string };
}

// --- Main Handler ---
export async function POST(request: Request) {
    try {
        const { startDate, endDate } = await request.json();
        if (!startDate || !endDate) {
            return NextResponse.json({ error: 'Start and end date are required' }, { status: 400 });
        }

        // 1. Fetch all necessary data
        const employeesResult = await query('SELECT id, name, group_name, default_work_hours, max_weekly_hours, max_weekly_days FROM employees ORDER BY id');
        const employees: Employee[] = employeesResult.rows;

        const requestsResult = await query('SELECT employee_id, date, request_type FROM shift_requests WHERE date BETWEEN $1 AND $2', [startDate, endDate]);
        const requests: ShiftRequest[] = requestsResult.rows.map((r: { employee_id: number, date: string, request_type: 'holiday' | 'work' }) => ({ ...r, date: format(parseISO(r.date), 'yyyy-MM-dd') }));
        
        const holidaysResult = await query('SELECT date FROM company_holidays WHERE date BETWEEN $1 AND $2', [startDate, endDate]);
        const holidays = new Set(holidaysResult.rows.map((h: { date: string }) => format(parseISO(h.date), 'yyyy-MM-dd')));

        // --- Main Algorithm ---
        const schedule: Schedule = {};
        const days = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) });

        // Initialize schedule with empty shifts
        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            schedule[dateStr] = {};
        });

        // 2. Apply hard constraints (Holiday requests)
        requests.forEach(req => {
            if (req.request_type === 'holiday') {
                schedule[req.date][req.employee_id] = '休み';
            }
        });

        // 3. Apply prioritized rules
        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayOfWeek = getDay(day);
            const isPostHoliday = dayOfWeek === 1 || holidays.has(format(subDays(day, 1), 'yyyy-MM-dd'));

            // Rule: Assign work on post-holidays
            if (isPostHoliday) {
                employees.forEach(emp => {
                    if (canWork(emp, dateStr, schedule, requests)) {
                        schedule[dateStr][emp.id] = emp.default_work_hours || '09:00-17:00';
                    }
                });
            }
        });

        // 4. Fill remaining shifts based on work requests and group distribution
        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const workRequests = requests.filter(r => r.date === dateStr && r.request_type === 'work');
            
            // Assign employees who requested to work
            workRequests.forEach(req => {
                const emp = employees.find(e => e.id === req.employee_id);
                if (emp && canWork(emp, dateStr, schedule, requests)) {
                    schedule[dateStr][emp.id] = emp.default_work_hours || '09:00-17:00';
                }
            });

            // Rule: Group distribution (simple version)
            const groupsInDay = new Set(Object.keys(schedule[dateStr]).map(empId => employees.find(e => e.id === Number(empId))?.group_name).filter(Boolean));
            const availableEmployees = employees.filter(emp => canWork(emp, dateStr, schedule, requests) && !groupsInDay.has(emp.group_name));

            availableEmployees.forEach(emp => {
                 if (canWork(emp, dateStr, schedule, requests)) {
                    schedule[dateStr][emp.id] = emp.default_work_hours || '09:00-17:00';
                 }
            });
        });
        
        // Replace empty slots with '休み' for clarity.
        Object.keys(schedule).forEach(date => {
            employees.forEach(emp => {
                if (!schedule[date][emp.id]) {
                    schedule[date][emp.id] = '休み';
                }
            });
        });

        return NextResponse.json(schedule);

    } catch (error) {
        console.error('Failed to generate schedule:', error);
        return NextResponse.json({ error: 'Failed to generate schedule' }, { status: 500 });
    }
}

// Helper function to check constraints
function canWork(emp: Employee, dateStr: string, schedule: Schedule, requests: ShiftRequest[]): boolean {
    // Already assigned or on holiday
    if (schedule[dateStr][emp.id] && schedule[dateStr][emp.id] !== '休み') return false;
    if (requests.some(r => r.employee_id === emp.id && r.date === dateStr && r.request_type === 'holiday')) return false;

    // Check weekly limits (simplified)
    const weekStart = format(startOfWeek(parseISO(dateStr), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    let daysInWeek = 0;
    for (let i = 0; i < 7; i++) {
        const d = format(addDays(parseISO(weekStart), i), 'yyyy-MM-dd');
        if (schedule[d] && schedule[d][emp.id] && schedule[d][emp.id] !== '休み') {
            daysInWeek++;
        }
    }

    if (emp.max_weekly_days && daysInWeek >= emp.max_weekly_days) {
        return false;
    }

    return true;
}
