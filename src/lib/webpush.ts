// スマホ・PCへのプッシュ通知（Web Push）を送るための最小限の実装。
// Cloudflare Workers でも Node.js でも動くよう、標準の Web Crypto API だけを使う。
//   - 暗号化: RFC 8291（aes128gcm）
//   - 送信元の証明: RFC 8292（VAPID）
// 鍵は scripts/generate-vapid-keys.mjs で作り、環境変数に設定する。

export interface PushSubscriptionData {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface VapidKeys {
  /** 公開鍵（base64url, 65バイトの非圧縮形式） */
  publicKey: string;
  /** 秘密鍵（base64url, 32バイト。JWK の d） */
  privateKey: string;
  /** 連絡先（mailto:... か https://...） */
  subject: string;
}

const enc = new TextEncoder();

export function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, length: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

/** 通知の中身を、受け取る端末の鍵で暗号化する（RFC 8291） */
export async function encryptPayload(
  payload: string,
  subscription: PushSubscriptionData,
  // テスト用に差し替えられるようにしている
  options: { salt?: Uint8Array<ArrayBuffer>; senderKeys?: CryptoKeyPair } = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublic = base64UrlDecode(subscription.keys.p256dh);
  const authSecret = base64UrlDecode(subscription.keys.auth);

  const senderKeys =
    options.senderKeys ??
    ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', senderKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, senderKeys.privateKey, 256),
  );

  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  // 最後のレコードであることを示す区切り 0x02 を付ける
  const plaintext = concat(enc.encode(payload), new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext));

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  return concat(salt, recordSize, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

/** 送信元（このアプリ）を証明する VAPID の Authorization ヘッダーを作る（RFC 8292） */
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, now = Date.now()): Promise<string> {
  const publicKey = base64UrlDecode(vapid.publicKey);
  if (publicKey.length !== 65 || publicKey[0] !== 4) throw new Error('VAPID_PUBLIC_KEY の形式が正しくありません。');
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: base64UrlEncode(publicKey.slice(1, 33)),
    y: base64UrlEncode(publicKey.slice(33, 65)),
    d: vapid.privateKey,
  };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);

  const header = base64UrlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = base64UrlEncode(
    enc.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(now / 1000) + 12 * 60 * 60,
        sub: vapid.subject,
      }),
    ),
  );
  const unsigned = `${header}.${claims}`;
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned));
  return `vapid t=${unsigned}.${base64UrlEncode(signature)}, k=${vapid.publicKey}`;
}

export interface PushResult {
  ok: boolean;
  status: number;
  /** 端末側で通知が解除されていて、登録を消してよい場合 true */
  gone: boolean;
}

/** 1台の端末へ通知を送る */
export async function sendWebPush(
  subscription: PushSubscriptionData,
  payload: string,
  vapid: VapidKeys,
  options: { ttlSeconds?: number } = {},
): Promise<PushResult> {
  const body = await encryptPayload(payload, subscription);
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(subscription.endpoint, vapid),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(options.ttlSeconds ?? 24 * 60 * 60),
      Urgency: 'normal',
    },
    body,
  });
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
}
