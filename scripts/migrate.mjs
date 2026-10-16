// scripts/migrate.mjs
// デプロイ（npm run build）のたびに自動実行されるDB更新スクリプト。
// 何度実行しても安全なように、すでに適用済みの変更はスキップする。
import pkg from 'pg';
const { Pool } = pkg;

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.log('INFO: POSTGRES_URL not set, skipping migrations.');
  process.exit(0);
}

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

const migrations = [
  {
    name: 'employees.hire_date',
    sql: 'ALTER TABLE employees ADD COLUMN IF NOT EXISTS hire_date DATE',
  },
  {
    name: 'employees.is_active',
    sql: 'ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE',
  },
  {
    name: 'shifts unique (employee_id, date)',
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'shifts'::regclass AND conname = 'unique_employee_date'
        ) THEN
          ALTER TABLE shifts ADD CONSTRAINT unique_employee_date UNIQUE (employee_id, date);
        END IF;
      END $$;
    `,
  },
];

const client = await pool.connect();
try {
  for (const m of migrations) {
    try {
      await client.query(m.sql);
      console.log(`SUCCESS: ${m.name}`);
    } catch (err) {
      // 1つ失敗しても他のマイグレーションとデプロイは続ける
      console.error(`ERROR: ${m.name}:`, err.message);
    }
  }
  console.log('All migrations executed.');
} finally {
  client.release();
  await pool.end();
}
