'use strict';

// assertBootConfig() reads process.env at call time, but each case still
// re-requires it via jest.isolateModules for isolation and to mirror the
// pattern used by the other config tests.
function loadAndRun(secret) {
  if (secret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = secret;
  }
  let assertBootConfig;
  jest.isolateModules(() => {
    ({ assertBootConfig } = require('../assertBootConfig'));
  });
  return () => assertBootConfig();
}

const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET;

afterEach(() => {
  if (ORIGINAL_JWT_SECRET === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
  }
});

describe('assertBootConfig', () => {
  it('passes for a valid, sufficiently long secret', () => {
    const run = loadAndRun('a'.repeat(64));
    expect(run).not.toThrow();
  });

  it('throws when JWT_SECRET is unset', () => {
    const run = loadAndRun(undefined);
    expect(run).toThrow(/JWT_SECRET must be set to a random string of at least 32 characters/);
  });

  it('throws when JWT_SECRET is shorter than 32 characters', () => {
    const run = loadAndRun('short-secret');
    expect(run).toThrow(/JWT_SECRET must be set to a random string of at least 32 characters/);
  });

  it.each([
    ['dev_only_change_this_in_production_use_64_random_chars_minimum'],
    ['change_me_to_a_64_char_random_string'],
  ])('throws when JWT_SECRET is the known placeholder %s', (placeholder) => {
    const run = loadAndRun(placeholder);
    expect(run).toThrow(/JWT_SECRET is still set to a known placeholder value/);
  });

  it('names the variable in both the length and placeholder error messages', () => {
    expect(loadAndRun('x')).toThrow(/JWT_SECRET/);
    expect(loadAndRun('change_me_to_a_64_char_random_string')).toThrow(/JWT_SECRET/);
  });
});
