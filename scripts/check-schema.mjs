import { query } from '../src/lib/db.mjs';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function checkSchema() {
  try {
    const shiftsCols = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'shifts'
    `);
    console.log('--- shifts table ---');
    console.table(shiftsCols.rows);

    const actualCols = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'actual_work_hours'
    `);
    console.log('--- actual_work_hours table ---');
    console.table(actualCols.rows);

    const empCols = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'employees'
    `);
    console.log('--- employees table ---');
    console.table(empCols.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkSchema();
