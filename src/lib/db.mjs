import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const dbPath = './db/shift.db';

let db = null;

export async function getDb() {
  if (!db) {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    // FIX: Enable foreign key constraints to ensure cascading deletes work
    await db.exec('PRAGMA foreign_keys = ON;');
  }
  return db;
}