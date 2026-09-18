'use strict';

const { shouldSurfaceOtp } = require('../../utils/otp');

// The rule that decides whether an OTP code is echoed back to the caller,
// restated here as a local predicate so the intended rule is documented
// executably. Named shouldSurfaceOtpSpec (rather than the brief's
// shouldSurfaceOtp) to avoid shadowing the real export under test below —
// its body is otherwise exactly the predicate both controllers now call.
function shouldSurfaceOtpSpec(env) {
  return env.NODE_ENV !== 'production' || env.DEMO_MODE === 'true';
}

describe('OTP surfacing rule (spec)', () => {
  it('surfaces in development, as it always has', () => {
    expect(shouldSurfaceOtpSpec({ NODE_ENV: 'development' })).toBe(true);
  });

  it('does not surface in production — the existing invariant', () => {
    expect(shouldSurfaceOtpSpec({ NODE_ENV: 'production' })).toBe(false);
  });

  it('surfaces in a demo deployment, which runs NODE_ENV=production', () => {
    expect(shouldSurfaceOtpSpec({ NODE_ENV: 'production', DEMO_MODE: 'true' })).toBe(true);
  });

  it('requires the literal string "true" — no loose truthiness', () => {
    expect(shouldSurfaceOtpSpec({ NODE_ENV: 'production', DEMO_MODE: '1' })).toBe(false);
    expect(shouldSurfaceOtpSpec({ NODE_ENV: 'production', DEMO_MODE: 'yes' })).toBe(false);
  });
});

// Both controllers import and call the real shouldSurfaceOtp from
// src/utils/otp.js rather than inlining the condition, so it can be
// asserted directly here — the code the controllers actually run, not just
// a restatement of the rule. No DB, bcrypt or Otp model needed: the helper
// is a pure function of an env object.
describe('OTP surfacing rule (real implementation — src/utils/otp.js)', () => {
  it('surfaces in development, as it always has', () => {
    expect(shouldSurfaceOtp({ NODE_ENV: 'development' })).toBe(true);
  });

  it('does not surface in production — the existing invariant', () => {
    expect(shouldSurfaceOtp({ NODE_ENV: 'production' })).toBe(false);
  });

  it('surfaces in a demo deployment, which runs NODE_ENV=production', () => {
    expect(shouldSurfaceOtp({ NODE_ENV: 'production', DEMO_MODE: 'true' })).toBe(true);
  });

  it('requires the literal string "true" — no loose truthiness', () => {
    expect(shouldSurfaceOtp({ NODE_ENV: 'production', DEMO_MODE: '1' })).toBe(false);
    expect(shouldSurfaceOtp({ NODE_ENV: 'production', DEMO_MODE: 'yes' })).toBe(false);
  });

  it('defaults to process.env when called with no argument, as both controllers call it', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalDemoMode = process.env.DEMO_MODE;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.DEMO_MODE;
      expect(shouldSurfaceOtp()).toBe(false);

      process.env.DEMO_MODE = 'true';
      expect(shouldSurfaceOtp()).toBe(true);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalDemoMode === undefined) {
        delete process.env.DEMO_MODE;
      } else {
        process.env.DEMO_MODE = originalDemoMode;
      }
    }
  });
});
