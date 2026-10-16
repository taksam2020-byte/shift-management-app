import { describe, expect, it } from 'vitest';
import { base64UrlDecode, base64UrlEncode, encryptPayload, vapidAuthorization } from '@/lib/webpush';
import { daysBetween, reminderDayFor, shortDate, todayInJapan } from '@/lib/notify';

const enc = new TextEncoder();

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, length: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

/** ブラウザ側と同じ手順（RFC 8291）で復号して、暗号化が正しいか確かめる */
async function decrypt(body: Uint8Array<ArrayBuffer>, ua: CryptoKeyPair, authSecret: Uint8Array<ArrayBuffer>) {
  const salt = body.slice(0, 16);
  const idLen = body[20];
  const asPublic = body.slice(21, 21 + idLen);
  const ciphertext = body.slice(21 + idLen);
  const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey));
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
  const keyInfo = new Uint8Array([...enc.encode('WebPush: info\0'), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(authSecret, ecdh, keyInfo, 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext));
  expect(plain[plain.length - 1]).toBe(2);
  return new TextDecoder().decode(plain.slice(0, -1));
}

describe('Web Push の暗号化', () => {
  it('端末の鍵で復号すると元の文章に戻る', async () => {
    const ua = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
    const authSecret = crypto.getRandomValues(new Uint8Array(16));
    const subscription = {
      endpoint: 'https://push.example.com/abc',
      keys: {
        p256dh: base64UrlEncode(await crypto.subtle.exportKey('raw', ua.publicKey)),
        auth: base64UrlEncode(authSecret),
      },
    };
    const payload = JSON.stringify({ title: 'シフトが更新されました', body: '10/21〜11/20', url: '/my-schedule' });
    const body = await encryptPayload(payload, subscription);
    expect(new DataView(body.buffer).getUint32(16)).toBe(4096);
    expect(await decrypt(body, ua, authSecret)).toBe(payload);
  });

  it('VAPID の署名が公開鍵で検証できる', async () => {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const publicKey = base64UrlEncode(await crypto.subtle.exportKey('raw', pair.publicKey));
    const { d } = await crypto.subtle.exportKey('jwk', pair.privateKey);
    const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/xyz', { publicKey, privateKey: d!, subject: 'mailto:a@example.com' }, 0);

    const match = header.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/)!;
    expect(match[4]).toBe(publicKey);
    const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(match[2])));
    expect(claims).toEqual({ aud: 'https://fcm.googleapis.com', exp: 12 * 60 * 60, sub: 'mailto:a@example.com' });
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pair.publicKey,
      base64UrlDecode(match[3]),
      enc.encode(`${match[1]}.${match[2]}`),
    );
    expect(ok).toBe(true);
  });
});

describe('締切リマインドの日付', () => {
  it('日本時間で今日を求める', () => {
    expect(todayInJapan(new Date('2026-10-15T14:59:00Z'))).toBe('2026-10-15');
    expect(todayInJapan(new Date('2026-10-15T15:00:00Z'))).toBe('2026-10-16');
  });
  it('締切の3日前と前日だけ送る', () => {
    expect(daysBetween('2026-10-17', '2026-10-20')).toBe(3);
    expect(reminderDayFor('2026-10-20', '2026-10-17')).toBe(3);
    expect(reminderDayFor('2026-10-20', '2026-10-19')).toBe(1);
    expect(reminderDayFor('2026-10-20', '2026-10-18')).toBeNull();
    expect(reminderDayFor('2026-10-20', '2026-10-20')).toBeNull();
    expect(reminderDayFor('2026-11-01', '2026-10-29')).toBe(3);
  });
  it('日付を短く表示する', () => {
    expect(shortDate('2026-01-05')).toBe('1/5');
  });
});
