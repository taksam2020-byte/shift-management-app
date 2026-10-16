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
  {
    name: 'push_subscriptions',
    sql: `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      role TEXT NOT NULL,
      employee_id INTEGER,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },
  {
    name: 'request_deadlines',
    sql: `CREATE TABLE IF NOT EXISTS request_deadlines (
      id SERIAL PRIMARY KEY,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      deadline DATE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },
  {
    name: 'notification_log',
    sql: `CREATE TABLE IF NOT EXISTS notification_log (
      kind TEXT NOT NULL,
      key TEXT NOT NULL,
      sent_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (kind, key)
    )`,
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
