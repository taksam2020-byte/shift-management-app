
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

// Main function to run the database initialization
async function initDb() {
  try {
    const dbPath = './db/shift.db';
    const dbDir = dirname(dbPath);

    // Create the directory for the database file if it doesn't exist
    await mkdir(dbDir, { recursive: true });

    // Open the database connection
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    console.log('Database connection opened.');

    // Create the employees table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        hourly_wage INTEGER NOT NULL,
        max_weekly_hours INTEGER,
        max_weekly_days INTEGER,
        annual_income_limit INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "employees" created or already exists.');

    // Create the shifts table
    // This will store the planned shifts assigned by the manager
    await db.exec(`
      CREATE TABLE IF NOT EXISTS shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        date TEXT NOT NULL, -- YYYY-MM-DD
        start_time TEXT, -- HH:MM
        end_time TEXT, -- HH:MM
        FOREIGN KEY (employee_id) REFERENCES employees (id)
      );
    `);
    console.log('Table "shifts" created or already exists.');

    // Create a table for employees to submit their availability/requests
    await db.exec(`
      CREATE TABLE IF NOT EXISTS shift_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        date TEXT NOT NULL, -- YYYY-MM-DD
        is_off_request BOOLEAN DEFAULT TRUE, -- TRUE if it's a day off request
        notes TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees (id)
      );
    `);
    console.log('Table "shift_requests" created or already exists.');

    // Create a table for actual work hours submitted by employees
    await db.exec(`
      CREATE TABLE IF NOT EXISTS actual_work_hours (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shift_id INTEGER NOT NULL,
        actual_start_time TEXT NOT NULL, -- HH:MM
        actual_end_time TEXT NOT NULL, -- HH:MM
        notes TEXT,
        FOREIGN KEY (shift_id) REFERENCES shifts (id)
      );
    `);
    console.log('Table "actual_work_hours" created or already exists.');


    await db.close();
    console.log('Database connection closed.');
    console.log('Database initialization complete!');

  } catch (err) {
    console.error('Error initializing database:', err.message);
  }
}

initDb();
