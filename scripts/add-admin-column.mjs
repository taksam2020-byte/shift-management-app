import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function addAdminColumn() {
  try {
    const db = await open({
      filename: './db/shift.db',
      driver: sqlite3.Database
    });

    console.log('Checking for is_admin column...');
    const tableInfo = await db.all("PRAGMA table_info(employees);");
    const columnExists = tableInfo.some(col => col.name === 'is_admin');

    if (!columnExists) {
      await db.exec('ALTER TABLE employees ADD COLUMN is_admin BOOLEAN DEFAULT FALSE');
      console.log('Column "is_admin" added to "employees" table.');
    } else {
      console.log('Column "is_admin" already exists.');
    }

    await db.close();
  } catch (err) {
    console.error('Error modifying database:', err.message);
  }
}

addAdminColumn();
