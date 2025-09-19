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
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        hourly_wage INTEGER NOT NULL,
        max_weekly_hours INTEGER,
        max_weekly_days INTEGER,
        annual_income_limit INTEGER,
        default_work_hours TEXT,
        request_type TEXT DEFAULT 'holiday' NOT NULL, -- 'holiday' or 'work'
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        initial_income INTEGER,
        initial_income_year INTEGER,
        group_name VARCHAR(50)
      );
    `);
    console.log('Table "employees" created or already exists.');

    // Drop default on employees.id if it exists
    const idSerialCheck = await client.query(`
      SELECT column_default 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'employees' 
        AND column_name = 'id' 
        AND column_default LIKE 'nextval%';
    `);
    if (idSerialCheck.rows.length > 0) {
      console.log('Migrating schema: Changing employees.id from SERIAL to INTEGER...');
      await client.query(`ALTER TABLE employees ALTER COLUMN id DROP DEFAULT;`);
      console.log('SUCCESS: employees.id is now manually assigned.');
    }

    // Create other tables...
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS actual_work_hours (
        id SERIAL PRIMARY KEY,
        shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        actual_start_time TIME NOT NULL, -- HH:MM
        actual_end_time TIME NOT NULL, -- HH:MM
        notes TEXT,
        break_hours NUMERIC(4, 2) DEFAULT 1.0,
        hourly_wage INTEGER
      );
    `);
    console.log('Table "actual_work_hours" created or already exists.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS company_holidays (
        date DATE PRIMARY KEY,
        note TEXT
      );
    `);
    console.log('Table "company_holidays" created or already exists.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_notes (
        date DATE PRIMARY KEY,
        note TEXT
      );
    `);
    console.log('Table "daily_notes" created or already exists.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_tokens (
        id SERIAL PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "auth_tokens" created or already exists.');

    await client.query('COMMIT');
    console.log('Successfully created/updated all tables!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating tables, rolled back transaction:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    console.log('Database connection closed.');
  }
}

createTables();