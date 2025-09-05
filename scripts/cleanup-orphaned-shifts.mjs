import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function cleanup() {
  console.log('Starting cleanup of orphaned shifts...');
  const db = await open({ filename: './db/shift.db', driver: sqlite3.Database });

  try {
    const result = await db.run(
      'DELETE FROM shifts WHERE employee_id NOT IN (SELECT id FROM employees)'
    );
    
    if (result.changes > 0) {
      console.log(`SUCCESS: Cleaned up ${result.changes} orphaned shift(s).`);
    } else {
      console.log('INFO: No orphaned shifts found to clean up.');
    }

  } catch (err) {
    console.error('ERROR during cleanup:', err.message);
  } finally {
    await db.close();
  }
}

cleanup();
