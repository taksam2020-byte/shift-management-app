// スマホ通知（Web Push）用の鍵を作るスクリプト。最初に1回だけ実行する。
//   node scripts/generate-vapid-keys.mjs
// 表示された値を Cloudflare（または Vercel）の環境変数に登録する。
// 鍵を作り直すと、登録済みの端末は通知をオンにし直す必要があるので注意。
const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify'],
);
const toB64Url = (buf) => Buffer.from(buf).toString('base64url');
const rawPublic = await crypto.subtle.exportKey('raw', publicKey);
const jwk = await crypto.subtle.exportKey('jwk', privateKey);

console.log('VAPID_PUBLIC_KEY=' + toB64Url(rawPublic));
console.log('VAPID_PRIVATE_KEY=' + jwk.d);
