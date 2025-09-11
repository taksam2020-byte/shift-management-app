import pkg from 'pg';
const { Pool } = pkg;

let pool;

function getDbPool() {
  if (!pool) {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error('POSTGRES_URL environment variable is not set.');
    }

    console.log('Creating new PostgreSQL connection pool.');
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false // Required for Neon DB connections
      }
    });
  }
  return pool;
}

// The query function can be used to run queries directly.
export async function query(text, params) {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}

// getDb is kept for compatibility with the existing API structure if needed,
// though using the query function directly is often cleaner.
export function getDb() {
  return getDbPool();
}
