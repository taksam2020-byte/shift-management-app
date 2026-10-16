// Cloudflare Workers の入口。
// OpenNext が作った Next.js 本体（fetch）に、Cron Trigger で毎日呼ばれる処理（scheduled）を追加する。
// @ts-ignore: ビルド時に生成されるファイル
import { default as handler } from '../.open-next/worker.js';

interface Env {
  CRON_SECRET?: string;
}

export default {
  fetch: handler.fetch,

  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    // アプリ内の /api/cron/reminders を直接呼び出す（外には出ない）
    const request = new Request('https://shift-kun.internal/api/cron/reminders', {
      headers: { authorization: `Bearer ${env.CRON_SECRET ?? ''}` },
    });
    ctx.waitUntil(
      Promise.resolve(handler.fetch(request, env, ctx)).then(async (res: Response) => {
        console.log('reminders:', res.status, await res.text());
      }),
    );
  },
};
