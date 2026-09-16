'use strict';

// Deliberately NOT mocking jsonwebtoken. The whole point of this suite is
// that real signature verification rejects real tampered tokens — a mocked
// jwt.verify would assert nothing about the control this middleware is.
process.env.JWT_SECRET = 'test-secret-do-not-use-anywhere-real';

const jwt = require('jsonwebtoken');
const { authenticateJWT } = require('../authMiddleware');
const { JWT_COOKIE_NAME } = require('../../config/constants');

const SECRET = process.env.JWT_SECRET;
const CLAIMS = { userId: 'u-1', username: 'dr.ahmed', role: 'doctor' };

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

/** Runs the middleware and resolves once it has either answered or called next(). */
function run(req) {
  const res = mockRes();
  const next = jest.fn();
  return new Promise((resolve) => {
    res.json.mockImplementation(() => {
      resolve({ res, next });
      return res;
    });
    next.mockImplementation(() => resolve({ res, next }));
    authenticateJWT(req, res, next);
  });
}

describe('authenticateJWT — token absent', () => {
  it('rejects a request with no cookies object at all', async () => {
    const { res, next } = await run({});
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a request whose cookie jar has no session token', async () => {
    const { res, next } = await run({ cookies: { other: 'value' } });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an empty-string token rather than passing it to verify', async () => {
    const { res, next } = await run({ cookies: { [JWT_COOKIE_NAME]: '' } });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('authenticateJWT — valid token', () => {
  it('calls next() and attaches the decoded claims', async () => {
    const token = jwt.sign(CLAIMS, SECRET, { algorithm: 'HS256', expiresIn: '15m' });
    const req = { cookies: { [JWT_COOKIE_NAME]: token } };
    const { res, next } = await run(req);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user).toEqual({ userId: 'u-1', username: 'dr.ahmed', role: 'doctor' });
  });

  it('copies only the three whitelisted claims, never the whole payload', async () => {
    // A token carrying extra claims must not silently widen req.user —
    // downstream code reads req.user.role to authorise.
    const token = jwt.sign(
      Object.assign({}, CLAIMS, { isSuperadmin: true, patientId: 'not-yours' }),
      SECRET,
      { algorithm: 'HS256', expiresIn: '15m' }
    );
    const req = { cookies: { [JWT_COOKIE_NAME]: token } };
    await run(req);

    expect(Object.keys(req.user).sort()).toEqual(['role', 'userId', 'username']);
    expect(req.user.isSuperadmin).toBeUndefined();
    expect(req.user.patientId).toBeUndefined();
  });

  it('carries the role claim through verbatim for RBAC to act on', async () => {
    for (const role of ['superadmin', 'doctor', 'admin', 'patient']) {
      const token = jwt.sign(
        Object.assign({}, CLAIMS, { role }),
        SECRET,
        { algorithm: 'HS256', expiresIn: '15m' }
      );
      const req = { cookies: { [JWT_COOKIE_NAME]: token } };
      await run(req);
      expect(req.user.role).toBe(role);
    }
  });
});

describe('authenticateJWT — token rejected', () => {
  it('rejects an expired token', async () => {
    const token = jwt.sign(CLAIMS, SECRET, { algorithm: 'HS256', expiresIn: '-10s' });
    const req = { cookies: { [JWT_COOKIE_NAME]: token } };
    const { res, next } = await run(req);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('rejects a structurally malformed token', async () => {
    const req = { cookies: { [JWT_COOKIE_NAME]: 'not-a-jwt' } };
    const { res, next } = await run(req);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a token whose payload was edited after signing', async () => {
    // Escalate role doctor -> superadmin in the payload while keeping the
    // original signature. This is the attack the signature check exists for.
    const token = jwt.sign(CLAIMS, SECRET, { algorithm: 'HS256', expiresIn: '15m' });
    const parts = token.split('.');
    const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    decoded.role = 'superadmin';
    const forgedPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url');
    const forged = parts[0] + '.' + forgedPayload + '.' + parts[2];

    const req = { cookies: { [JWT_COOKIE_NAME]: forged } };
    const { res, next } = await run(req);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('rejects a token signed with a different secret', async () => {
    const token = jwt.sign(CLAIMS, 'some-other-secret', { algorithm: 'HS256', expiresIn: '15m' });
    const { res, next } = await run({ cookies: { [JWT_COOKIE_NAME]: token } });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an alg=none token (algorithm-confusion attack)', async () => {
    // Unsigned token with the algorithm downgraded to "none". The explicit
    // algorithms: ['HS256'] allowlist in the middleware is what blocks this.
    const unsigned = jwt.sign(CLAIMS, null, { algorithm: 'none' });
    const { res, next } = await run({ cookies: { [JWT_COOKIE_NAME]: unsigned } });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('gives the same message for expiry and for tampering (no failure-mode leak)', async () => {
    const expired = jwt.sign(CLAIMS, SECRET, { algorithm: 'HS256', expiresIn: '-10s' });
    const wrongSecret = jwt.sign(CLAIMS, 'other', { algorithm: 'HS256', expiresIn: '15m' });

    const a = await run({ cookies: { [JWT_COOKIE_NAME]: expired } });
    const b = await run({ cookies: { [JWT_COOKIE_NAME]: wrongSecret } });

    expect(a.res.json.mock.calls[0][0]).toEqual({ error: 'Invalid or expired session' });
    expect(b.res.json.mock.calls[0][0]).toEqual({ error: 'Invalid or expired session' });
  });
});

describe('authenticateJWT — cookie-only delivery', () => {
  it('ignores a valid token presented in the Authorization header', async () => {
    // Chapter 4 §4.3.8.1: the token is httpOnly-cookie-only precisely so XSS
    // cannot read or replay it. Accepting a header would undo that.
    const token = jwt.sign(CLAIMS, SECRET, { algorithm: 'HS256', expiresIn: '15m' });
    const req = { headers: { authorization: 'Bearer ' + token }, cookies: {} };
    const { res, next } = await run(req);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });
});
