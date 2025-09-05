import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// This script is designed to be safe to run multiple times.

async function migrateDb() {
  console.log('Starting database migration...');
  const db = await open({ filename: './db/shift.db', driver: sqlite3.Database });

  try {
    await db.exec('BEGIN TRANSACTION');

    // 1. Add default_work_hours to employees table
    const empInfo = await db.all("PRAGMA table_info(employees);");
    if (!empInfo.some(col => col.name === 'default_work_hours')) {
      await db.exec('ALTER TABLE employees ADD COLUMN default_work_hours TEXT');
      console.log('SUCCESS: Added default_work_hours column to employees.');
    } else {
      console.log('INFO: default_work_hours column already exists.');
    }

    // 2. Create daily_notes table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS daily_notes (
        date TEXT PRIMARY KEY,
        note TEXT
      );
    `);
    console.log('SUCCESS: daily_notes table created or already exists.');

    // 3. Recreate tables to add ON DELETE CASCADE constraints
    // This is the standard safe way to alter constraints in SQLite
    console.log('INFO: Checking and applying ON DELETE CASCADE constraints...');

    // For shifts table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS shifts_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
      );
    `);
    await db.exec('INSERT INTO shifts_new SELECT * FROM shifts;');
    await db.exec('DROP TABLE shifts;');
    await db.exec('ALTER TABLE shifts_new RENAME TO shifts;');
    console.log('SUCCESS: shifts table updated with ON DELETE CASCADE.');

    // For shift_requests table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS shift_requests_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        is_off_request BOOLEAN DEFAULT TRUE,
        notes TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
      );
    `);
    await db.exec('INSERT INTO shift_requests_new SELECT * FROM shift_requests;');
    await db.exec('DROP TABLE shift_requests;');
    await db.exec('ALTER TABLE shift_requests_new RENAME TO shift_requests;');
    console.log('SUCCESS: shift_requests table updated with ON DELETE CASCADE.');

    // For actual_work_hours table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS actual_work_hours_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shift_id INTEGER NOT NULL,
        actual_start_time TEXT NOT NULL,
        actual_end_time TEXT NOT NULL,
        notes TEXT,
        FOREIGN KEY (shift_id) REFERENCES shifts (id) ON DELETE CASCADE
      );
    `);
    await db.exec('INSERT INTO actual_work_hours_new SELECT * FROM actual_work_hours;');
    await db.exec('DROP TABLE actual_work_hours;');
    await db.exec('ALTER TABLE actual_work_hours_new RENAME TO actual_work_hours;');
    console.log('SUCCESS: actual_work_hours table updated with ON DELETE CASCADE.');

    await db.exec('COMMIT');
    console.log('Database migration completed successfully!');

  } catch (err) {
    console.error('ERROR during migration, rolling back...', err.message);
    await db.exec('ROLLBACK');
  } finally {
    await db.close();
  }
}

migrateDb();
