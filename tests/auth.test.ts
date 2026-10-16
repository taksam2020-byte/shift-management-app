import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db.mjs', () => ({ query: vi.fn() }));

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret';
});

describe('セッショントークン', async () => {
  const { createSessionToken, verifySessionToken, safeEqual } = await import('@/lib/auth');

  it('発行したトークンは検証できる', () => {
    const token = createSessionToken({ role: 'employee', id: 3, name: '山田' });
    expect(verifySessionToken(token)).toMatchObject({ role: 'employee', id: 3, name: '山田' });
  });

  it('中身を書き換えたトークンは無効（管理者へのなりすまし防止）', () => {
    const token = createSessionToken({ role: 'employee', id: 3, name: '山田' });
    const [, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ role: 'admin', id: 0, name: 'x', exp: Date.now() + 1e9 })).toString('base64url');
    expect(verifySessionToken(`${forged}.${sig}`)).toBeNull();
  });

  it('期限切れのトークンは無効', () => {
    const token = createSessionToken({ role: 'admin', id: 0, name: '管理者' }, Date.now() - 30 * 24 * 60 * 60 * 1000);
    expect(verifySessionToken(token)).toBeNull();
  });

  it('壊れた値や空の値は無効', () => {
    expect(verifySessionToken(undefined)).toBeNull();
    expect(verifySessionToken('abc')).toBeNull();
    expect(verifySessionToken('a.b')).toBeNull();
  });

  it('パスワード比較', () => {
    expect(safeEqual('secret', 'secret')).toBe(true);
    expect(safeEqual('secret', 'Secret')).toBe(false);
  });
});
