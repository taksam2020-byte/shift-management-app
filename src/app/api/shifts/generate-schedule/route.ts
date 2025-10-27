import { NextResponse } from 'next/server';
import { query } from '@/lib/db.mjs';
import { eachDayOfInterval, getDay, startOfWeek, parseISO, addDays, subDays } from 'date-fns';
import holiday_jp from '@holiday-jp/holiday_jp';

// --- Types ---
interface Employee {
    id: number;
    name: string;
    group_name: string | null;
    default_work_hours: string | null;
    max_weekly_hours: number | null;
    max_weekly_days: number | null;
    hourly_wage: number;
    annual_income_limit: number | null;
    initial_income: number | null;
    initial_income_year: number | null;
}

interface ShiftRequest {
    employee_id: number;
    date: string; // YYYY-MM-DD
    request_type: 'holiday' | 'work';
}

interface Schedule {
    [date: string]: { [employeeId: number]: string };
}

// --- Helper Functions ---
function formatDateUTC(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getShiftHours(shift: string): number {
    if (!shift || shift === '休み') {
        return 0;
    }
    const [start, end] = shift.split('-');
    if (!start || !end) {
        return 0;
    }
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);

    const startTime = startHour + startMinute / 60;
    const endTime = endHour + endMinute / 60;

    let duration = endTime - startTime;
    if (duration < 0) { // Handle overnight shifts if necessary
        duration += 24;
    }

    // Assume a 1-hour break for shifts over 6 hours
    if (duration > 6) {
        return duration - 1;
    }

    return duration;
}

// --- POST Handler Body ---
export async function POST(request: Request) {
    try {
        const { startDate, endDate } = await request.json();
        if (!startDate || !endDate) {
            return NextResponse.json({ error: 'Start and end date are required' }, { status: 400 });
        }

        // --- Phase 1: Data Fetching & Preparation ---
        const employeesResult = await query('SELECT id, name, group_name, default_work_hours, max_weekly_hours, max_weekly_days, hourly_wage, annual_income_limit, initial_income, initial_income_year FROM employees ORDER BY id');
        const employees: Employee[] = employeesResult.rows;

        const requestsResult = await query('SELECT employee_id, date, request_type FROM shift_requests WHERE date BETWEEN $1 AND $2', [startDate, endDate]);
        const companyHolidaysResult = await query('SELECT date FROM company_holidays WHERE date BETWEEN $1 AND $2', [startDate, endDate]);

        const allDays = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) });
        const schedule: Schedule = {};

        // --- Pre-computation: Create lookup sets/maps for efficiency ---
        const nonWorkDays = new Set<string>();
        // Add company-specific holidays
        const companyHolidayDates = companyHolidaysResult.rows.map((h: { date: Date }) => formatDateUTC(h.date));
        companyHolidayDates.forEach((d: string) => nonWorkDays.add(d));
        // Add public holidays (from holiday_jp)
        const publicHolidays = holiday_jp.between(parseISO(startDate), parseISO(endDate));
        publicHolidays.forEach(h => nonWorkDays.add(formatDateUTC(h.date)));
        // Add weekends
        allDays.forEach(day => {
            const dayOfWeek = getDay(day);
            if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
                nonWorkDays.add(formatDateUTC(day));
            }
        });

        const holidayRequests = new Map<number, Set<string>>();
        const workRequests = new Map<number, Set<string>>();
        requestsResult.rows.forEach((r: { employee_id: number, date: Date, request_type: 'holiday' | 'work' }) => {
            const dateStr = formatDateUTC(r.date);
            const map = r.request_type === 'holiday' ? holidayRequests : workRequests;
            if (!map.has(r.employee_id)) {
                map.set(r.employee_id, new Set());
            }
            map.get(r.employee_id)!.add(dateStr);
        });

        // --- Phase 2: Schedule Initialization (Hard Constraints) ---
        allDays.forEach(day => {
            const dateStr = formatDateUTC(day);
            schedule[dateStr] = {};

            // Apply non-work days (weekends, company holidays) to everyone
            if (nonWorkDays.has(dateStr)) {
                employees.forEach(emp => {
                    schedule[dateStr][emp.id] = '休み';
                });
                return; // Skip to next day
            }

            // Apply individual holiday requests
            employees.forEach(emp => {
                if (holidayRequests.get(emp.id)?.has(dateStr)) {
                    schedule[dateStr][emp.id] = '休み';
                }
            });
        });

        // --- Phase 3: Prioritize Work Requests & Post-Holiday ---
        const workDays = allDays.filter(d => !nonWorkDays.has(formatDateUTC(d)));

        // Step 3.1: Assign employees with specific work requests FIRST (highest priority)
        workDays.forEach(day => {
            const dateStr = formatDateUTC(day);
            employees.forEach(emp => {
                if (workRequests.get(emp.id)?.has(dateStr)) {
                    if (!schedule[dateStr][emp.id] && canWork(emp, dateStr, schedule, allDays)) {
                        schedule[dateStr][emp.id] = emp.default_work_hours || '09:00-17:00';
                    }
                }
            });
        });

        // Step 3.2: Assign all available staff to post-holiday days
        workDays.forEach(day => {
            const dateStr = formatDateUTC(day);
            const dayOfWeek = getDay(day);
            const isPostHoliday = dayOfWeek === 1 || nonWorkDays.has(formatDateUTC(subDays(day, 1)));

            if (isPostHoliday) {
                employees.forEach(emp => {
                    // If not already assigned and can work, assign them
                    if (!schedule[dateStr][emp.id] && canWork(emp, dateStr, schedule, allDays)) {
                        schedule[dateStr][emp.id] = emp.default_work_hours || '09:00-17:00';
                    }
                });
            }
        });

        // --- Phase 4: Multi-Pass Assignment for Remaining Slots ---
        let pass = 1;
        while (true) {
            let assignmentsInThisPass = 0;

            for (const day of workDays) {
                const dateStr = formatDateUTC(day);
                const dayOfWeek = getDay(day);
                const isPostHoliday = dayOfWeek === 1 || nonWorkDays.has(formatDateUTC(subDays(day, 1)));
                
                const targetForToday = isPostHoliday ? pass + 1 : pass;
                const assignedCount = Object.keys(schedule[dateStr]).filter(empId => schedule[dateStr][Number(empId)] !== '休み').length;

                if (assignedCount < targetForToday) {
                    // Calculate average hours for fairness scoring
                    let totalHoursAllEmployees = 0;
                    employees.forEach(e => {
                        allDays.forEach(d => {
                            const shift = schedule[formatDateUTC(d)]?.[e.id];
                            if (shift && shift !== '休み') {
                                totalHoursAllEmployees += getShiftHours(shift);
                            }
                        });
                    });
                    const avgHours = employees.length > 0 ? totalHoursAllEmployees / employees.length : 0;

                    // Find best candidate
                    let bestCandidate: Employee | null = null;
                    let highestScore = -Infinity;

                    for (const emp of employees) {
                        if (schedule[dateStr][emp.id]) continue; // Already assigned or on holiday

                        if (canWork(emp, dateStr, schedule, allDays)) {
                            let score = calculateScore(emp, schedule, allDays, avgHours);
                            
                            const groupsInDay = new Set(Object.keys(schedule[dateStr])
                                .map(empId => employees.find(e => e.id === Number(empId))?.group_name)
                                .filter(Boolean));
                            
                            if (emp.group_name && !groupsInDay.has(emp.group_name)) {
                                score += 40; // Bonus for adding a new group
                            }

                            if (score > highestScore) {
                                highestScore = score;
                                bestCandidate = emp;
                            }
                        }
                    }

                    if (bestCandidate) {
                        schedule[dateStr][bestCandidate.id] = bestCandidate.default_work_hours || '09:00-17:00';
                        assignmentsInThisPass++;
                    }
                }
            }

            if (assignmentsInThisPass === 0) {
                break; // No more assignments can be made across all days
            }
            pass++;
        }

        // --- Phase 5: Finalization ---
        Object.keys(schedule).forEach(date => {
            employees.forEach(emp => {
                if (!schedule[date][emp.id]) {
                    schedule[date][emp.id] = '休み';
                }
            });
        });

        return NextResponse.json(schedule);

    } catch (error) {
        console.error('[GENERATE_SCHEDULE] CRITICAL ERROR:', error);
        if (error instanceof Error) {
            console.error(error.stack);
        }
        return NextResponse.json({ error: 'Failed to generate schedule' }, { status: 500 });
    }
}

function calculateScore(emp: Employee, schedule: Schedule, allDays: Date[], avgHours: number): number {
    let score = 100;

    // Fairness: Give a bonus to employees who have worked fewer hours than average
    let totalHours = 0;
    allDays.forEach(day => {
        const d = formatDateUTC(day);
        const shift = schedule[d]?.[emp.id];
        if (shift && shift !== '休み') {
            totalHours += getShiftHours(shift);
        }
    });

    if (avgHours > 0) {
        score += (avgHours - totalHours);
    }

    return score;
}

function canWork(emp: Employee, dateStr: string, schedule: Schedule, allDays: Date[]): boolean {
    // 1. Already assigned?
    if (schedule[dateStr]?.[emp.id]) {
        return false; // Already has an assignment (work or holiday)
    }

    const weekStart = startOfWeek(parseISO(dateStr), { weekStartsOn: 1 }); // Week starts on Monday
    let daysInWeek = 0;
    let hoursInWeek = 0;

    for (let i = 0; i < 7; i++) {
        const d = formatDateUTC(addDays(weekStart, i));
        const shift = schedule[d]?.[emp.id];
        if (shift && shift !== '休み') {
            daysInWeek++;
            hoursInWeek += getShiftHours(shift);
        }
    }

    // 2. Weekly day limit
    if (emp.max_weekly_days && daysInWeek >= emp.max_weekly_days) {
        return false;
    }

    // 3. Weekly hour limit
    const prospectiveShiftHours = getShiftHours(emp.default_work_hours || '09:00-17:00');
    if (emp.max_weekly_hours && (hoursInWeek + prospectiveShiftHours) > emp.max_weekly_hours) {
        return false;
    }

    // 4. Annual income limit
    if (emp.annual_income_limit && emp.hourly_wage) {
        const currentYear = new Date().getFullYear();
        let totalIncome = 0;

        if (emp.initial_income && emp.initial_income_year === currentYear) {
            totalIncome += emp.initial_income;
        }

        allDays.forEach(day => {
            const d = formatDateUTC(day);
            const shift = schedule[d]?.[emp.id];
            if (shift && shift !== '休み') {
                totalIncome += getShiftHours(shift) * emp.hourly_wage;
            }
        });

        const prospectiveIncome = prospectiveShiftHours * emp.hourly_wage;
        if ((totalIncome + prospectiveIncome) > emp.annual_income_limit) {
            return false;
        }
    }

    return true;
}
