import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function createCompanyHolidaysTable() {
  try {
    const db = await open({ filename: './db/shift.db', driver: sqlite3.Database });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS company_holidays (
        date TEXT PRIMARY KEY,
        note TEXT
      );
    `);
    console.log('SUCCESS: company_holidays table created or already exists.');

    await db.close();
  } catch (err) {
    console.error('ERROR creating company_holidays table:', err.message);
  }
}

createCompanyHolidaysTable();
