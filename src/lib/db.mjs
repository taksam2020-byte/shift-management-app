import pkg from 'pg';
const { Pool, Client } = pkg;

// Cloudflare Workers では、ある通信で作った DB 接続を別の通信で使い回せない。
// そのため Workers 上では毎回新しく接続し、使い終わったら閉じる。
// （Vercel やローカルでは今まで通り接続プールを使い回す）
const isCloudflareWorkers =
  typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';

function getConfig() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('POSTGRES_URL environment variable is not set.');
  }
  return {
    connectionString,
    // ローカルの検証用DBなど、URL に sslmode=disable と書いた場合だけ暗号化しない
    ssl: /sslmode=disable/.test(connectionString)
      ? false
      : { rejectUnauthorized: false } // Required for Neon DB connections
  };
}

let pool;

function getDbPool() {
  if (!pool) {
    console.log('Creating new PostgreSQL connection pool.');
    pool = new Pool(getConfig());
  }
  return pool;
}

/** Workers 用：プールと同じ使い方（connect → release）ができる、毎回作り直す接続 */
const perRequestPool = {
  async connect() {
    const client = new Client(getConfig());
    await client.connect();
    client.release = () => {
      client.end().catch(() => {});
    };
    return client;
  },
  async query(text, params) {
    const client = await perRequestPool.connect();
    try {
      return await client.query(text, params);
    } finally {
      client.release();
    }
  },
};

// The query function can be used to run queries directly.
export async function query(text, params) {
  if (isCloudflareWorkers) return perRequestPool.query(text, params);
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
  return isCloudflareWorkers ? perRequestPool : getDbPool();
}
