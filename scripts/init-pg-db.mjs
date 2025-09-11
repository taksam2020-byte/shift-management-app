import pkg from 'pg';
const { Pool } = pkg;

async function createTables() {
  // Vercel will provide the connection string via this environment variable.
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('FATAL: POSTGRES_URL environment variable is not set.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false // Required for Neon DB connections
    }
  });

  const client = await pool.connect();
  console.log('Connected to PostgreSQL database!');

  try {
    // Start transaction
    await client.query('BEGIN');

    // Create Employees Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        hourly_wage INTEGER NOT NULL,
        max_weekly_hours INTEGER,
        max_weekly_days INTEGER,
        annual_income_limit INTEGER,
        default_work_hours TEXT,
        request_type TEXT DEFAULT 'holiday' NOT NULL, -- 'holiday' or 'work'
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "employees" created or already exists.');

    // Create Shifts Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        date DATE NOT NULL, -- YYYY-MM-DD
        start_time TIME, -- HH:MM
        end_time TIME -- HH:MM
      );
    `);
    console.log('Table "shifts" created or already exists.');

    // Create Shift Requests Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS shift_requests (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        date DATE NOT NULL, -- YYYY-MM-DD
        notes TEXT,
        request_type TEXT DEFAULT 'holiday' NOT NULL
      );
    `);
    console.log('Table "shift_requests" created or already exists.');

    // Create Actual Work Hours Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS actual_work_hours (
        id SERIAL PRIMARY KEY,
        shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        actual_start_time TIME NOT NULL, -- HH:MM
        actual_end_time TIME NOT NULL, -- HH:MM
        notes TEXT
      );
    `);
    console.log('Table "actual_work_hours" created or already exists.');

    // Create Company Holidays Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS company_holidays (
        date DATE PRIMARY KEY,
        note TEXT
      );
    `);
    console.log('Table "company_holidays" created or already exists.');

    // Create Daily Notes Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_notes (
        date DATE PRIMARY KEY,
        note TEXT
      );
    `);
    console.log('Table "daily_notes" created or already exists.');

    // Commit transaction
    await client.query('COMMIT');
    console.log('Successfully created all tables!');

  } catch (err) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Error creating tables, rolled back transaction:', err);
    process.exit(1); // Exit with error
  } finally {
    // Release the client and end the pool
    client.release();
    await pool.end();
    console.log('Database connection closed.');
  }
}

createTables();
