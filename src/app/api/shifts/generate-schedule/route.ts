import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';
import { eachDayOfInterval, format, getDay, startOfWeek, parseISO, addDays, subDays } from 'date-fns';

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

        // --- Pre-process requests for easier lookup ---
        const holidayRequests = new Map<number, Set<string>>();
        const workRequests = new Map<number, Set<string>>();
        requests.forEach(req => {
            const map = req.request_type === 'holiday' ? holidayRequests : workRequests;
            if (!map.has(req.employee_id)) {
                map.set(req.employee_id, new Set());
            }
            map.get(req.employee_id)!.add(req.date);
        });

        // --- Main Algorithm ---
        const schedule: Schedule = {};
        const days = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) });

        // Initialize schedule
        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            schedule[dateStr] = {};
            // Apply holiday requests first
            employees.forEach(emp => {
                if (holidayRequests.get(emp.id)?.has(dateStr)) {
                    schedule[dateStr][emp.id] = '休み';
                }
            });
        });

        // --- Assignment Logic ---
        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayOfWeek = getDay(day);
            const isPostHoliday = dayOfWeek === 1 || holidays.has(format(subDays(day, 1), 'yyyy-MM-dd'));

            // Rule 1: Post-holiday assignment
            if (isPostHoliday) {
                employees.forEach(emp => {
                    if (canWork(emp, dateStr, schedule)) {
                        schedule[dateStr][emp.id] = emp.default_work_hours || '09:00-17:00';
                    }
                });
            }

            // Rule 2: Work requests assignment
            employees.forEach(emp => {
                if (workRequests.get(emp.id)?.has(dateStr) && canWork(emp, dateStr, schedule)) {
                    schedule[dateStr][emp.id] = emp.default_work_hours || '09:00-17:00';
                }
            });

            // Rule 3: Group distribution (simple version)
            const groupsInDay = new Set(Object.values(schedule[dateStr]).length > 0 ? 
                Object.keys(schedule[dateStr]).map(empId => employees.find(e => e.id === Number(empId))?.group_name).filter(Boolean) : []
            );
            const availableEmployees = employees.filter(emp => canWork(emp, dateStr, schedule) && !groupsInDay.has(emp.group_name));

            availableEmployees.forEach(emp => {
                schedule[dateStr][emp.id] = emp.default_work_hours || '09:00-17:00';
            });
        });
        
        // Final cleanup: Mark unassigned slots as '休み'
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
function canWork(emp: Employee, dateStr: string, schedule: Schedule): boolean {
    // Already assigned or on holiday
    if (schedule[dateStr][emp.id]) {
        return false;
    }

    // Check weekly limits
    if (emp.max_weekly_days) {
        const weekStart = startOfWeek(parseISO(dateStr), { weekStartsOn: 1 });
        let daysInWeek = 0;
        for (let i = 0; i < 7; i++) {
            const d = format(addDays(weekStart, i), 'yyyy-MM-dd');
            if (schedule[d] && schedule[d][emp.id] && schedule[d][emp.id] !== '休み') {
                daysInWeek++;
            }
        }
        if (daysInWeek >= emp.max_weekly_days) {
            return false;
        }
    }

    return true;
}