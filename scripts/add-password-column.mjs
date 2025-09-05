import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function addPasswordColumn() {
  try {
    const db = await open({
      filename: './db/shift.db',
      driver: sqlite3.Database
    });

    console.log('Checking for password_hash column...');
    const tableInfo = await db.all("PRAGMA table_info(employees);");
    const columnExists = tableInfo.some(col => col.name === 'password_hash');

    if (!columnExists) {
      await db.exec('ALTER TABLE employees ADD COLUMN password_hash TEXT');
      console.log('Column "password_hash" added to "employees" table.');
    } else {
      console.log('Column "password_hash" already exists.');
    }

    await db.close();
  } catch (err) {
    console.error('Error modifying database:', err.message);
  }
}

addPasswordColumn();
