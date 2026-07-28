import { query } from '../src/lib/db.mjs';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function run() {
  try {
    const sql = `
      SELECT 
        s.id as shift_id,
        s.date,
        s.start_time,
        s.end_time,
        e.name as employee_name,
        e.id as employee_id
      FROM shifts s
      JOIN employees e ON s.employee_id = e.id
      LEFT JOIN actual_work_hours a ON s.id = a.shift_id
      WHERE s.date < CURRENT_DATE
        AND s.start_time IS NOT NULL
        AND (a.id IS NULL OR a.actual_start_time IS NULL)
      ORDER BY s.date ASC, e.id ASC
    `;
    const result = await query(sql);
    console.log(`Found ${result.rows.length} unentered shifts.`);
    console.table(result.rows.slice(0, 10)); // 先頭10件
  } catch (error) {
    console.error(error);
  } finally {
    process.exit();
  }
}

run();
