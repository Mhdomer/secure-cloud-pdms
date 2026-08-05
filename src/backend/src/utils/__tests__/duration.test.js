'use strict';

const { parseDurationMs } = require('../duration');

describe('parseDurationMs', () => {
  it('returns the fallback when value is falsy', () => {
    expect(parseDurationMs(undefined, 1234)).toBe(1234);
    expect(parseDurationMs('', 1234)).toBe(1234);
    expect(parseDurationMs(null, 1234)).toBe(1234);
  });

  it('treats a bare integer string as seconds, per jsonwebtoken convention', () => {
    expect(parseDurationMs('900', 0)).toBe(900 * 1000);
    expect(parseDurationMs('0', 999)).toBe(0);
  });

  it.each([
    ['15s', 15 * 1000],
    ['15m', 15 * 60 * 1000],
    ['8h', 8 * 60 * 60 * 1000],
    ['1d', 24 * 60 * 60 * 1000],
  ])('parses %s as %i ms', (input, expected) => {
    expect(parseDurationMs(input, 0)).toBe(expected);
  });

  it('trims surrounding whitespace before matching', () => {
    expect(parseDurationMs(' 15m ', 0)).toBe(15 * 60 * 1000);
  });

  it('returns the fallback for an unrecognized unit or malformed string', () => {
    expect(parseDurationMs('15x', 4242)).toBe(4242);
    expect(parseDurationMs('not-a-duration', 4242)).toBe(4242);
  });
});
