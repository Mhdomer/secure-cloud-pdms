'use strict';

// database.js opens a real pg Pool at require time and throws unless the
// DB_* vars are present, so it is mocked wholesale here. The real
// withTransaction session-variable contract is asserted separately in
// src/config/__tests__/database.test.js, and end to end against a live
// PostgreSQL in src/__tests__/rls-isolation.test.js.
jest.mock('../../config/database', () => ({ withTransaction: jest.fn() }));

const { withTransaction } = require('../../config/database');
const { setupRLSContext } = require('../rlsContext');
const { ROLES } = require('../../config/constants');

/**
 * Stands in for withTransaction: records the session it was handed, then
 * runs the callback against a client that returns `rows`.
 */
function respondWith(rows) {
  withTransaction.mockImplementation((session, callback) => {
    const client = { query: jest.fn(async () => ({ rows })) };
    return Promise.resolve(callback(client)).then((result) => {
      withTransaction.lastClient = client;
      return result;
    });
  });
}

function run(user) {
  const req = { user };
  const next = jest.fn();
  return new Promise((resolve, reject) => {
    next.mockImplementation((err) => (err ? reject(err) : resolve({ req, next })));
    setupRLSContext(req, {}, next);
  });
}

beforeEach(() => {
  withTransaction.mockReset();
  delete withTransaction.lastClient;
});

describe('setupRLSContext — doctor session', () => {
  it('resolves doctor_id and leaves patient_id null', async () => {
    respondWith([{ doctor_id: 'doc-42' }]);
    const { req } = await run({ userId: 'u-1', role: ROLES.DOCTOR });

    expect(req.rlsSession).toEqual({
      userId: 'u-1',
      role: ROLES.DOCTOR,
      doctorId: 'doc-42',
      patientId: null,
    });
  });

  it('looks the doctor up by user_id, not by doctor_id', async () => {
    respondWith([{ doctor_id: 'doc-42' }]);
    await run({ userId: 'u-1', role: ROLES.DOCTOR });

    const [sql, params] = withTransaction.lastClient.query.mock.calls[0];
    expect(sql).toMatch(/FROM doctors WHERE user_id = \$1/);
    expect(params).toEqual(['u-1']);
  });

  it('runs the lookup with a null session, since doctors has no RLS', async () => {
    respondWith([{ doctor_id: 'doc-42' }]);
    await run({ userId: 'u-1', role: ROLES.DOCTOR });
    expect(withTransaction.mock.calls[0][0]).toBeNull();
  });

  it('yields null (never undefined) when the user has no doctors row', async () => {
    // undefined would serialise into set_config as the string "undefined";
    // null is what the empty-string guard in withTransaction expects.
    respondWith([]);
    const { req } = await run({ userId: 'u-1', role: ROLES.DOCTOR });
    expect(req.rlsSession.doctorId).toBeNull();
  });
});

describe('setupRLSContext — patient session', () => {
  it('resolves patient_id and leaves doctor_id null', async () => {
    respondWith([{ patient_id: 'pat-7' }]);
    const { req } = await run({ userId: 'u-2', role: ROLES.PATIENT });

    expect(req.rlsSession).toEqual({
      userId: 'u-2',
      role: ROLES.PATIENT,
      doctorId: null,
      patientId: 'pat-7',
    });
  });

  it('runs the bootstrap lookup under a real session, since patients IS RLS-protected', async () => {
    // patient_select_own is keyed on user_id precisely so this one query can
    // resolve patient_id without a circular dependency. A null session here
    // would return zero rows for every patient.
    respondWith([{ patient_id: 'pat-7' }]);
    await run({ userId: 'u-2', role: ROLES.PATIENT });

    expect(withTransaction.mock.calls[0][0]).toEqual({
      userId: 'u-2',
      role: ROLES.PATIENT,
      doctorId: null,
      patientId: null,
    });
  });

  it('looks the patient up by user_id, matching the patient_select_own policy', async () => {
    respondWith([{ patient_id: 'pat-7' }]);
    await run({ userId: 'u-2', role: ROLES.PATIENT });

    const [sql, params] = withTransaction.lastClient.query.mock.calls[0];
    expect(sql).toMatch(/FROM patients WHERE user_id = \$1/);
    expect(params).toEqual(['u-2']);
  });

  it('yields null when the user has no patients row', async () => {
    respondWith([]);
    const { req } = await run({ userId: 'u-2', role: ROLES.PATIENT });
    expect(req.rlsSession.patientId).toBeNull();
  });
});

describe('setupRLSContext — admin and superadmin sessions', () => {
  it.each([ROLES.ADMIN, ROLES.SUPERADMIN])(
    'touches the database not at all for %s, and nulls both surrogate keys',
    async (role) => {
      const { req } = await run({ userId: 'u-3', role });
      expect(withTransaction).not.toHaveBeenCalled();
      expect(req.rlsSession).toEqual({ userId: 'u-3', role, doctorId: null, patientId: null });
    }
  );

  it('leaves doctorId/patientId null, which is what the ::uuid guard must absorb', async () => {
    // These nulls become '' in withTransaction and must be NULLIF-guarded in
    // every policy, or an admin request 500s. See
    // docs/psm2/rls-policy-guidelines.md — this already broke local dev once.
    const { req } = await run({ userId: 'u-3', role: ROLES.ADMIN });
    expect(req.rlsSession.doctorId).toBeNull();
    expect(req.rlsSession.patientId).toBeNull();
  });
});

describe('setupRLSContext — session shape and failure handling', () => {
  it('attaches exactly the four keys withTransaction reads', async () => {
    respondWith([{ doctor_id: 'doc-42' }]);
    const { req } = await run({ userId: 'u-1', role: ROLES.DOCTOR });
    expect(Object.keys(req.rlsSession).sort()).toEqual(['doctorId', 'patientId', 'role', 'userId']);
  });

  it('forwards a lookup failure to next(err) rather than leaving req.rlsSession unset', async () => {
    withTransaction.mockRejectedValue(new Error('connection terminated'));
    await expect(run({ userId: 'u-1', role: ROLES.DOCTOR })).rejects.toThrow('connection terminated');
  });

  it('never calls next() twice on the happy path', async () => {
    respondWith([{ doctor_id: 'doc-42' }]);
    const { next } = await run({ userId: 'u-1', role: ROLES.DOCTOR });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });
});
