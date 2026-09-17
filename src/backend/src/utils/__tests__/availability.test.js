'use strict';

// isSlotAvailable performs two checks in order: the doctor's working hours,
// then an overlap check. The overlap check stopped reading `appointments`
// directly when that table became RLS-protected — this function runs inside
// the caller's own session, including a patient's during self-booking, where
// the policies correctly hide every other patient's row. A direct query would
// see an empty table and report a taken slot as free.
//
// These tests pin the ordering, the short-circuit, and the routing through
// doctor_slot_taken() without needing a database. Behaviour against live
// policies is covered in src/__tests__/rls-isolation.test.js.

const { isSlotAvailable } = require('../availability');

const DOCTOR = '11111111-1111-1111-1111-111111111111';
const SLOT = '2026-11-03T09:00:00.000Z';
const APPT = '22222222-2222-2222-2222-222222222222';

/**
 * Mocks the two queries in order: the working-hours lookup, then the overlap
 * helper. `withinHours` false means the doctor is not working then.
 */
function clientFor({ withinHours, taken }) {
  const client = { query: jest.fn() };
  client.query
    .mockResolvedValueOnce({ rows: withinHours ? [{ '?column?': 1 }] : [] })
    .mockResolvedValueOnce({ rows: [{ taken }] });
  return client;
}

describe('isSlotAvailable', () => {
  it('is available when the doctor is working and nothing overlaps', async () => {
    const client = clientFor({ withinHours: true, taken: false });
    await expect(isSlotAvailable(client, DOCTOR, SLOT, 30)).resolves.toBe(true);
  });

  it('is unavailable when an existing appointment overlaps', async () => {
    const client = clientFor({ withinHours: true, taken: true });
    await expect(isSlotAvailable(client, DOCTOR, SLOT, 30)).resolves.toBe(false);
  });

  it('is unavailable outside working hours, without running the overlap check', async () => {
    // Short-circuit matters: no point asking whether a slot is taken on a day
    // the doctor does not work.
    const client = clientFor({ withinHours: false, taken: false });
    await expect(isSlotAvailable(client, DOCTOR, SLOT, 30)).resolves.toBe(false);
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it('asks doctor_slot_taken rather than querying appointments directly', async () => {
    const client = clientFor({ withinHours: true, taken: false });
    await isSlotAvailable(client, DOCTOR, SLOT, 30);

    const [overlapSql] = client.query.mock.calls[1];
    expect(overlapSql).toMatch(/doctor_slot_taken/);
    expect(overlapSql).not.toMatch(/FROM\s+appointments/i);
  });

  it('checks working hours first, against doctor_availability', async () => {
    const client = clientFor({ withinHours: true, taken: false });
    await isSlotAvailable(client, DOCTOR, SLOT, 30);

    const [hoursSql, hoursParams] = client.query.mock.calls[0];
    expect(hoursSql).toMatch(/doctor_availability/);
    expect(hoursParams).toEqual([DOCTOR, SLOT, 30]);
  });

  it('forwards the exclusion so a reschedule does not clash with itself', async () => {
    const client = clientFor({ withinHours: true, taken: false });
    await isSlotAvailable(client, DOCTOR, SLOT, 30, APPT);
    expect(client.query.mock.calls[1][1]).toEqual([DOCTOR, SLOT, 30, APPT]);
  });

  it('defaults the exclusion to null for a fresh booking', async () => {
    const client = clientFor({ withinHours: true, taken: false });
    await isSlotAvailable(client, DOCTOR, SLOT, 30);
    expect(client.query.mock.calls[1][1]).toEqual([DOCTOR, SLOT, 30, null]);
  });

  it('treats only an explicit false as available, never a loose falsy value', async () => {
    // The helper returns a real boolean; anything else means the contract
    // changed and the caller should fail closed rather than book over it.
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [{ taken: null }] });
    await expect(isSlotAvailable(client, DOCTOR, SLOT, 30)).resolves.toBe(false);
  });
});
