import pkg from 'pg';
const { Pool } = pkg;

async function addHireDateColumn() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('FATAL: POSTGRES_URL environment variable is not set.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  const client = await pool.connect();
  console.log('Connected to PostgreSQL database!');

  try {
    await client.query('BEGIN');
    // Add the hire_date column to the employees table if it doesn't exist
    await client.query(`
      ALTER TABLE employees
      ADD COLUMN IF NOT EXISTS hire_date DATE;
    `);
    console.log('SUCCESS: Column "hire_date" added to "employees" table or already exists.');
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error adding column, rolled back transaction:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    console.log('Database connection closed.');
  }
}

addHireDateColumn();
