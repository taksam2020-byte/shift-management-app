// Cloudflare Workers で Next.js を動かすための設定（@opennextjs/cloudflare）
// 画面はすべてログイン後に毎回データを取りに行く作りなので、ページのキャッシュ保存先は使わない。
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
