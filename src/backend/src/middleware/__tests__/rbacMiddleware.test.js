'use strict';

const { authorizeRole } = require('../rbacMiddleware');
const { ROLES } = require('../../config/constants');

const DENIED = { error: 'You do not have permission to access this resource' };

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

/** Applies a guard to a request bearing `role` and reports what happened. */
function attempt(guard, role) {
  const req = role === undefined ? {} : { user: { userId: 'u-1', role } };
  const res = mockRes();
  const next = jest.fn();
  guard(req, res, next);
  return {
    allowed: next.mock.calls.length === 1,
    status: res.status.mock.calls[0] ? res.status.mock.calls[0][0] : null,
    body: res.json.mock.calls[0] ? res.json.mock.calls[0][0] : null,
  };
}

const ALL_ROLES = [ROLES.SUPERADMIN, ROLES.DOCTOR, ROLES.ADMIN, ROLES.PATIENT];

describe('authorizeRole — full role/permission matrix', () => {
  // Each guard below is one that genuinely appears in src/routes. The
  // expected column is the complete set of roles that must get through.
  const matrix = [
    { guard: [ROLES.DOCTOR], allow: [ROLES.DOCTOR, ROLES.SUPERADMIN] },
    { guard: [ROLES.ADMIN], allow: [ROLES.ADMIN, ROLES.SUPERADMIN] },
    { guard: [ROLES.PATIENT], allow: [ROLES.PATIENT, ROLES.SUPERADMIN] },
    { guard: [ROLES.SUPERADMIN], allow: [ROLES.SUPERADMIN] },
    { guard: [ROLES.ADMIN, ROLES.DOCTOR], allow: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.SUPERADMIN] },
    { guard: [ROLES.DOCTOR, ROLES.PATIENT], allow: [ROLES.DOCTOR, ROLES.PATIENT, ROLES.SUPERADMIN] },
    { guard: [ROLES.ADMIN, ROLES.PATIENT], allow: [ROLES.ADMIN, ROLES.PATIENT, ROLES.SUPERADMIN] },
    { guard: ALL_ROLES, allow: ALL_ROLES },
  ];

  matrix.forEach(({ guard, allow }) => {
    const label = 'authorizeRole(' + guard.join(', ') + ')';

    ALL_ROLES.forEach((role) => {
      const shouldPass = allow.includes(role);
      it(label + ' ' + (shouldPass ? 'admits' : 'rejects') + ' ' + role, () => {
        const result = attempt(authorizeRole(...guard), role);
        expect(result.allowed).toBe(shouldPass);
        if (!shouldPass) {
          expect(result.status).toBe(403);
          expect(result.body).toEqual(DENIED);
        }
      });
    });
  });
});

describe('authorizeRole — the three thesis claims', () => {
  it('keeps admin out of clinical data (medical records are DOCTOR / DOCTOR+PATIENT only)', () => {
    // Mirrors medicalRecords.routes.js:37, :55, :66, :77, :95 and
    // labResults.routes.js — ROLES.ADMIN appears on none of them.
    const clinicalGuards = [
      authorizeRole(ROLES.DOCTOR),
      authorizeRole(ROLES.DOCTOR, ROLES.PATIENT),
    ];
    clinicalGuards.forEach((guard) => {
      const result = attempt(guard, ROLES.ADMIN);
      expect(result.allowed).toBe(false);
      expect(result.status).toBe(403);
    });
  });

  it('keeps patient out of every write-side clinical and administrative route', () => {
    const writeGuards = [
      authorizeRole(ROLES.DOCTOR),
      authorizeRole(ROLES.ADMIN),
      authorizeRole(ROLES.ADMIN, ROLES.DOCTOR),
      authorizeRole(ROLES.SUPERADMIN),
    ];
    writeGuards.forEach((guard) => {
      expect(attempt(guard, ROLES.PATIENT).allowed).toBe(false);
    });
  });

  it('keeps doctor out of admin-only registration and user management', () => {
    expect(attempt(authorizeRole(ROLES.ADMIN), ROLES.DOCTOR).allowed).toBe(false);
    expect(attempt(authorizeRole(ROLES.SUPERADMIN), ROLES.DOCTOR).allowed).toBe(false);
  });

  it('does NOT separate one doctor from another — that is RLS’s job, not this layer’s', () => {
    // Two different doctors are indistinguishable here: this middleware only
    // ever sees a role string. Row ownership is enforced by the PostgreSQL
    // policies, covered in rls-isolation.test.js. Asserted so the second
    // layer is never assumed to be redundant.
    const guard = authorizeRole(ROLES.DOCTOR);
    expect(attempt(guard, ROLES.DOCTOR).allowed).toBe(true);
    expect(attempt(guard, ROLES.DOCTOR).allowed).toBe(true);
  });
});

describe('authorizeRole — superadmin inheritance', () => {
  it('admits superadmin to every guard, including ones that never list it', () => {
    [[ROLES.DOCTOR], [ROLES.ADMIN], [ROLES.PATIENT], [ROLES.ADMIN, ROLES.DOCTOR]].forEach((g) => {
      expect(attempt(authorizeRole(...g), ROLES.SUPERADMIN).allowed).toBe(true);
    });
  });

  it('admits superadmin even to a guard listing no roles at all', () => {
    // Documented consequence of the inheritance branch running before the
    // allowlist check. Every other role is denied by such a guard.
    expect(attempt(authorizeRole(), ROLES.SUPERADMIN).allowed).toBe(true);
  });

  it('reaches clinical routes that RLS only blocks for role=admin', () => {
    // medical_records has a RESTRICTIVE policy denying role 'admin' — it
    // does not name 'superadmin'. So superadmin passing here is reachable
    // clinical access, by design. Pinned so a later change is deliberate.
    expect(attempt(authorizeRole(ROLES.DOCTOR), ROLES.SUPERADMIN).allowed).toBe(true);
  });
});

describe('authorizeRole — deny by default', () => {
  it('denies when authenticateJWT never ran (no req.user)', () => {
    const result = attempt(authorizeRole(ROLES.DOCTOR), undefined);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
    expect(result.body).toEqual(DENIED);
  });

  it('denies a guard that lists no roles for every non-superadmin role', () => {
    [ROLES.DOCTOR, ROLES.ADMIN, ROLES.PATIENT].forEach((role) => {
      expect(attempt(authorizeRole(), role).allowed).toBe(false);
    });
  });

  it('matches the role exactly — no case-insensitivity, padding, or prefix match', () => {
    const guard = authorizeRole(ROLES.DOCTOR);
    ['Doctor', 'DOCTOR', 'doctor ', ' doctor', 'doctors', 'doc'].forEach((role) => {
      expect(attempt(guard, role).allowed).toBe(false);
    });
  });

  it('denies an unknown or absent role string', () => {
    [null, undefined, '', 'root', 'system'].forEach((role) => {
      const req = { user: { userId: 'u-1', role } };
      const res = mockRes();
      const next = jest.fn();
      authorizeRole(ROLES.DOCTOR)(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  it('is not fooled by inherited Object.prototype members', () => {
    // roles.includes() on an array is safe against this, unlike a bare
    // object-key lookup. Pinned so a refactor to a map keeps the property.
    ['toString', 'constructor', '__proto__', 'hasOwnProperty'].forEach((role) => {
      expect(attempt(authorizeRole(ROLES.DOCTOR), role).allowed).toBe(false);
    });
  });

  it('returns a generic message that does not disclose which roles are allowed', () => {
    const result = attempt(authorizeRole(ROLES.SUPERADMIN), ROLES.PATIENT);
    expect(result.body).toEqual(DENIED);
    expect(JSON.stringify(result.body)).not.toMatch(/superadmin/i);
  });
});
