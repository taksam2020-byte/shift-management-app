import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pkg;

async function runMigration() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('FATAL: POSTGRES_URL environment variable is not set.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  console.log('Connected to PostgreSQL database for migration!');

  try {
    await client.query('BEGIN');

    // Check if is_active column exists
    const checkRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='employees' AND column_name='is_active'
    `);

    if (checkRes.rowCount === 0) {
      console.log('Adding is_active column to employees table...');
      await client.query(`ALTER TABLE employees ADD COLUMN is_active BOOLEAN DEFAULT TRUE`);
      console.log('Successfully added is_active column.');
    } else {
      console.log('is_active column already exists.');
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during migration:', err);
  } finally {
    client.release();
    await pool.end();
    console.log('Database connection closed.');
  }
}

runMigration();
