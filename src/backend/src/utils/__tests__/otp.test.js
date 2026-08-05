'use strict';

const { generateOtpCode, OTP_TTL_MS, MAX_OTP_ATTEMPTS } = require('../otp');

describe('generateOtpCode', () => {
  it('returns a 6-digit numeric string', () => {
    const code = generateOtpCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('zero-pads codes below 100000', () => {
    // Force crypto.randomInt to return a small value so the padding path
    // actually gets exercised, not just the common 6-digit case.
    const cryptoModule = require('crypto');
    const spy = jest.spyOn(cryptoModule, 'randomInt').mockReturnValue(42);
    expect(generateOtpCode()).toBe('000042');
    spy.mockRestore();
  });

  it('produces different codes across calls (not a fixed value)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateOtpCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('OTP constants', () => {
  it('exports a 5-minute TTL', () => {
    expect(OTP_TTL_MS).toBe(5 * 60 * 1000);
  });

  it('exports a 5-attempt limit', () => {
    expect(MAX_OTP_ATTEMPTS).toBe(5);
  });
});
