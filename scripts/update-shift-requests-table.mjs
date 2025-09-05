import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function updateShiftRequestsTable() {
  try {
    const db = await open({
      filename: './db/shift.db',
      driver: sqlite3.Database
    });
    await db.exec('PRAGMA foreign_keys=OFF;');

    console.log('Checking for request_type column in shift_requests...');
    const tableInfo = await db.all("PRAGMA table_info(shift_requests);");
    const columnExists = tableInfo.some(col => col.name === 'request_type');

    if (!columnExists) {
      console.log('Recreating table shift_requests to add request_type and drop is_off_request...');
      await db.exec('BEGIN TRANSACTION');
      
      await db.exec(`
        CREATE TABLE shift_requests_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employee_id INTEGER NOT NULL,
          date TEXT NOT NULL,
          notes TEXT,
          request_type TEXT DEFAULT 'holiday' NOT NULL,
          FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
        );
      `);

      await db.exec(`
        INSERT INTO shift_requests_new (id, employee_id, date, notes, request_type)
        SELECT id, employee_id, date, notes, 
               CASE WHEN is_off_request = 1 THEN 'holiday' ELSE 'work' END
        FROM shift_requests;
      `);

      await db.exec('DROP TABLE shift_requests');
      await db.exec('ALTER TABLE shift_requests_new RENAME TO shift_requests');

      await db.exec('COMMIT');
      console.log('SUCCESS: shift_requests table updated successfully.');

    } else {
      console.log('INFO: request_type column already exists in shift_requests. No action needed.');
    }

    await db.exec('PRAGMA foreign_keys=ON;');

    await db.close();
  } catch (err) {
    console.error('Error updating shift_requests table:', err.message);
    const dbForRollback = await open({ filename: './db/shift.db', driver: sqlite3.Database }).catch(() => null);
    if(dbForRollback) {
        await dbForRollback.exec('ROLLBACK');
        await dbForRollback.exec('PRAGMA foreign_keys=ON;');
    }
  }
}

updateShiftRequestsTable();
