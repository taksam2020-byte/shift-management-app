import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import holiday_jp from '@holiday-jp/holiday_jp';

async function cleanupHolidayNotes() {
  try {
    const db = await open({
      filename: './db/shift.db',
      driver: sqlite3.Database
    });

    // Get all holidays for the past, current, and next year for a comprehensive list
    const currentYear = new Date().getFullYear();
    const holidays = [
        ...holiday_jp.between(new Date(currentYear - 1, 0, 1), new Date(currentYear - 1, 11, 31)),
        ...holiday_jp.between(new Date(currentYear, 0, 1), new Date(currentYear, 11, 31)),
        ...holiday_jp.between(new Date(currentYear + 1, 0, 1), new Date(currentYear + 1, 11, 31)),
    ];

    const holidayNames = new Set(holidays.map(h => h.name));

    console.log(`Found ${holidayNames.size} unique holiday names to check.`);

    // Find notes that match a holiday name
    const notesToDelete = await db.all(
        `SELECT date, note FROM daily_notes WHERE note IN (${Array.from(holidayNames).map(() => '?').join(',')})`,
        ...Array.from(holidayNames)
    );

    if (notesToDelete.length === 0) {
        console.log('No notes matching holiday names found. No cleanup needed.');
        await db.close();
        return;
    }

    console.log(`Found ${notesToDelete.length} notes that might be unintentionally saved holidays. Cleaning up...`);

    await db.exec('BEGIN TRANSACTION');
    const stmt = await db.prepare('DELETE FROM daily_notes WHERE date = ? AND note = ?');

    let deletedCount = 0;
    for (const note of notesToDelete) {
        // Double-check if the date of the note is actually a holiday
        const isHoliday = holidays.some(h => h.date.toISOString().slice(0, 10) === note.date && h.name === note.note);
        if (isHoliday) {
            await stmt.run(note.date, note.note);
            deletedCount++;
        }
    }

    await stmt.finalize();
    await db.exec('COMMIT');

    console.log(`SUCCESS: Cleanup complete. Deleted ${deletedCount} unintentionally saved holiday notes.`);

    await db.close();
  } catch (err) {
    console.error('Error during database cleanup:', err.message);
  }
}

cleanupHolidayNotes();