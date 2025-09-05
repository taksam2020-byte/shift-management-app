import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function addBreakHoursColumn() {
  try {
    const db = await open({
      filename: './db/shift.db',
      driver: sqlite3.Database
    });

    console.log('Checking for break_hours column...');
    const tableInfo = await db.all("PRAGMA table_info(actual_work_hours);");
    const columnExists = tableInfo.some(col => col.name === 'break_hours');

    if (!columnExists) {
      // Add the new column with a default value of 1 hour.
      await db.exec('ALTER TABLE actual_work_hours ADD COLUMN break_hours REAL DEFAULT 1');
      console.log('SUCCESS: Column "break_hours" added to "actual_work_hours" table.');
    } else {
      console.log('INFO: Column "break_hours" already exists.');
    }

    await db.close();
  } catch (err) {
    console.error('Error modifying database:', err.message);
  }
}

addBreakHoursColumn();
