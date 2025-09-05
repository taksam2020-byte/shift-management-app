import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function addRequestTypeColumn() {
  try {
    const db = await open({
      filename: './db/shift.db',
      driver: sqlite3.Database
    });

    console.log('Checking for request_type column...');
    const tableInfo = await db.all("PRAGMA table_info(employees);");
    const columnExists = tableInfo.some(col => col.name === 'request_type');

    if (!columnExists) {
      // Add the new column. 'holiday' for requesting days off, 'work' for requesting work days.
      await db.exec("ALTER TABLE employees ADD COLUMN request_type TEXT DEFAULT 'holiday' NOT NULL");
      console.log('SUCCESS: Column "request_type" added to "employees" table.');
    } else {
      console.log('INFO: Column "request_type" already exists.');
    }

    await db.close();
  } catch (err) {
    console.error('Error modifying database:', err.message);
  }
}

addRequestTypeColumn();
