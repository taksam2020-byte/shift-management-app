import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function removeAdminColumn() {
  try {
    const db = await open({
      filename: './db/shift.db',
      driver: sqlite3.Database
    });

    console.log('Checking for is_admin column...');
    const tableInfo = await db.all("PRAGMA table_info(employees);");
    const columnExists = tableInfo.some(col => col.name === 'is_admin');

    if (columnExists) {
      console.log('Recreating table to remove "is_admin" column...');
      await db.exec('BEGIN TRANSACTION');
      
      await db.exec(`
        CREATE TABLE employees_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          hourly_wage INTEGER NOT NULL,
          max_weekly_hours INTEGER,
          max_weekly_days INTEGER,
          annual_income_limit INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await db.exec(`
        INSERT INTO employees_new (id, name, hourly_wage, max_weekly_hours, max_weekly_days, annual_income_limit, created_at)
        SELECT id, name, hourly_wage, max_weekly_hours, max_weekly_days, annual_income_limit, created_at FROM employees;
      `);

      await db.exec('DROP TABLE employees');
      await db.exec('ALTER TABLE employees_new RENAME TO employees');

      await db.exec('COMMIT');
      console.log('Column "is_admin" successfully removed.');

    } else {
      console.log('Column "is_admin" does not exist. No action needed.');
    }

    await db.close();
  } catch (err) {
    // If an error occurs, rollback the transaction
    // Note: This is a best-effort, a db object might not be available on connection error
    const dbForRollback = await open({ filename: './db/shift.db', driver: sqlite3.Database }).catch(() => null);
    if(dbForRollback) {
        await dbForRollback.exec('ROLLBACK');
    }
    console.error('Error modifying database:', err.message);
  }
}

removeAdminColumn();
