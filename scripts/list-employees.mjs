import pkg from 'pg';
const { Pool } = pkg;

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("POSTGRES_URL is not set.");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT id, name FROM employees ORDER BY id');
    console.log('--- EMPLOYEES ---');
    res.rows.forEach(row => {
      console.log(`ID: ${row.id}, 名前: ${row.name}`);
    });
    console.log('-----------------');
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}
main();
