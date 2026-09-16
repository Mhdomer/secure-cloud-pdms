'use strict';

// The JS half of the RLS session-variable contract: what withTransaction
// actually sends to PostgreSQL. The SQL half — that the policies survive
// those values — is asserted against a live database in
// src/__tests__/rls-isolation.test.js.

const mockClient = { query: jest.fn(), release: jest.fn() };
const mockPool = { connect: jest.fn(async () => mockClient), on: jest.fn() };

jest.mock('pg', () => ({ Pool: jest.fn(() => mockPool) }));
jest.mock('../logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }));

process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'pdms_test';
process.env.DB_USER = 'pdms_app';
process.env.DB_PASSWORD = 'unused-by-the-mock';
process.env.DB_SSL = 'false';

const { withTransaction } = require('../database');

/** Every set_config call made during the last transaction, as name -> value. */
function sessionVarsSent() {
  const vars = {};
  mockClient.query.mock.calls
    .filter(([sql]) => typeof sql === 'string' && sql.includes('set_config'))
    .forEach(([, params]) => {
      vars[params[0]] = params[1];
    });
  return vars;
}

function sqlSent() {
  return mockClient.query.mock.calls.map(([sql]) => sql);
}

beforeEach(() => {
  mockClient.query.mockReset();
  mockClient.query.mockResolvedValue({ rows: [] });
  mockClient.release.mockReset();
  mockPool.connect.mockClear();
});

describe('withTransaction — session variables', () => {
  const session = { userId: 'u-1', role: 'doctor', doctorId: 'doc-42', patientId: null };

  it('sets all four session variables the RLS policies read', async () => {
    await withTransaction(session, async () => 'ok');
    expect(sessionVarsSent()).toEqual({
      'app.current_user_id': 'u-1',
      'app.current_role': 'doctor',
      'app.current_doctor_id': 'doc-42',
      'app.current_patient_id': '',
    });
  });

  it('scopes every session variable to the transaction (set_config is_local = true)', async () => {
    // Without is_local the value would persist on the pooled connection and
    // leak into the next request, which is a cross-tenant read waiting to
    // happen. This is the single most important assertion in this file.
    await withTransaction(session, async () => 'ok');
    const setConfigCalls = mockClient.query.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('set_config')
    );
    expect(setConfigCalls).toHaveLength(4);
    setConfigCalls.forEach(([sql]) => {
      // is_local is the third argument of set_config and is baked into the
      // SQL text rather than parameterised, so assert on the statement.
      expect(sql).toMatch(/set_config\(\$1,\s*\$2,\s*true\)/);
    });
  });

  it('sends the empty string, never null or "undefined", for absent surrogate keys', async () => {
    // This is the JS half of the NULLIF(..., '') guard. If these arrived as
    // the literal string "null"/"undefined", NULLIF would not neutralise
    // them and the ::uuid cast would throw 22P02 for every admin request.
    await withTransaction({ userId: 'u-3', role: 'admin' }, async () => 'ok');
    const vars = sessionVarsSent();
    expect(vars['app.current_doctor_id']).toBe('');
    expect(vars['app.current_patient_id']).toBe('');
    expect(Object.values(vars)).not.toContain(null);
    expect(Object.values(vars)).not.toContain('null');
    expect(Object.values(vars)).not.toContain('undefined');
  });

  it('empties every field of a session object that is present but blank', async () => {
    await withTransaction({}, async () => 'ok');
    expect(sessionVarsSent()).toEqual({
      'app.current_user_id': '',
      'app.current_role': '',
      'app.current_doctor_id': '',
      'app.current_patient_id': '',
    });
  });

  it('sets no session variables at all when the session is null', async () => {
    await withTransaction(null, async () => 'ok');
    expect(sessionVarsSent()).toEqual({});
  });
});

describe('withTransaction — transaction lifecycle', () => {
  it('wraps the callback in BEGIN and COMMIT and returns its value', async () => {
    const result = await withTransaction(null, async () => 'payload');
    expect(result).toBe('payload');
    expect(sqlSent()).toContain('BEGIN');
    expect(sqlSent()).toContain('COMMIT');
  });

  it('sets the session variables before the callback runs, not after', async () => {
    let sqlAtCallbackTime = [];
    await withTransaction({ userId: 'u-1', role: 'patient', patientId: 'pat-7' }, async () => {
      sqlAtCallbackTime = sqlSent();
      return 'ok';
    });
    const setConfigsBefore = sqlAtCallbackTime.filter((s) => s.includes('set_config'));
    expect(setConfigsBefore).toHaveLength(4);
  });

  it('opens SERIALIZABLE only when asked', async () => {
    await withTransaction(null, async () => 'ok', { isolationLevel: 'SERIALIZABLE' });
    expect(sqlSent()).toContain('BEGIN ISOLATION LEVEL SERIALIZABLE');
    expect(sqlSent()).not.toContain('BEGIN');
  });

  it('rolls back and rethrows when the callback fails', async () => {
    const boom = new Error('unique_violation');
    await expect(withTransaction(null, async () => { throw boom; })).rejects.toThrow('unique_violation');
    expect(sqlSent()).toContain('ROLLBACK');
    expect(sqlSent()).not.toContain('COMMIT');
  });

  it('releases the client on success', async () => {
    await withTransaction(null, async () => 'ok');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('releases the client on failure, so a failed request cannot exhaust the pool', async () => {
    await expect(withTransaction(null, async () => { throw new Error('x'); })).rejects.toThrow();
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('still releases the client when the ROLLBACK itself fails', async () => {
    mockClient.query.mockImplementation(async (sql) => {
      if (sql === 'ROLLBACK') throw new Error('connection already closed');
      return { rows: [] };
    });
    await expect(withTransaction(null, async () => { throw new Error('original'); }))
      .rejects.toThrow('original');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });
});
