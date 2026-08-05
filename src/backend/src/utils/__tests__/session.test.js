'use strict';

jest.mock('jsonwebtoken', () => ({ sign: jest.fn(() => 'signed.jwt.token') }));

const jwt = require('jsonwebtoken');
const { cookieOptions, issueSessionCookie } = require('../session');

describe('cookieOptions', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('defaults to secure httpOnly SameSite=Strict cookies', () => {
    delete process.env.COOKIE_SECURE;
    const opts = cookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.secure).toBe(true);
    expect(opts.sameSite).toBe('strict');
    expect(opts.path).toBe('/');
  });

  it('is only ever insecure when COOKIE_SECURE is the literal string "false"', () => {
    process.env.COOKIE_SECURE = 'false';
    expect(cookieOptions().secure).toBe(false);
  });

  it('treats any other COOKIE_SECURE value as secure (fail-safe default)', () => {
    process.env.COOKIE_SECURE = 'nope';
    expect(cookieOptions().secure).toBe(true);
  });

  it('derives maxAge from JWT_EXPIRES_IN', () => {
    process.env.JWT_EXPIRES_IN = '30m';
    expect(cookieOptions().maxAge).toBe(30 * 60 * 1000);
  });

  it('falls back to a 15-minute maxAge when JWT_EXPIRES_IN is unset', () => {
    delete process.env.JWT_EXPIRES_IN;
    expect(cookieOptions().maxAge).toBe(15 * 60 * 1000);
  });
});

describe('issueSessionCookie', () => {
  beforeEach(() => {
    jwt.sign.mockClear();
  });

  it('signs a JWT with the user id/username/role and sets it as the auth cookie', () => {
    const res = { cookie: jest.fn() };
    const user = { user_id: 'u1', username: 'dr.fahad', role: 'doctor' };

    issueSessionCookie(res, user);

    expect(jwt.sign).toHaveBeenCalledWith(
      { userId: 'u1', username: 'dr.fahad', role: 'doctor' },
      process.env.JWT_SECRET,
      expect.objectContaining({ expiresIn: expect.any(String) })
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'token',
      'signed.jwt.token',
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' })
    );
  });
});
