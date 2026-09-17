'use strict';

// findConflict stopped reading `appointments` directly when that table became
// RLS-protected — a patient self-booking can no longer see other patients'
// rows, so a direct query would find no clash and permit a double booking.
// These tests pin the routing through appointment_conflict_id() as well as the
// return shape, without needing a database. Full behaviour against live
// policies is covered in src/__tests__/rls-isolation.test.js.

const Appointment = require('../Appointment');

function executorReturning(rows) {
  return { query: jest.fn(async () => ({ rows })) };
}

const DOCTOR = '11111111-1111-1111-1111-111111111111';
const SLOT = '2026-11-03T09:00:00.000Z';
const APPT = '22222222-2222-2222-2222-222222222222';

describe('Appointment.findConflict', () => {
  it('asks the SECURITY DEFINER helper rather than querying appointments', () => {
    const executor = executorReturning([{ appointment_id: null }]);
    Appointment.findConflict(executor, DOCTOR, SLOT);

    const [sql] = executor.query.mock.calls[0];
    expect(sql).toMatch(/appointment_conflict_id/);
    expect(sql).not.toMatch(/FROM\s+appointments/i);
  });

  it('passes doctor, timestamp and exclusion through in order', async () => {
    const executor = executorReturning([{ appointment_id: null }]);
    await Appointment.findConflict(executor, DOCTOR, SLOT, APPT);
    expect(executor.query.mock.calls[0][1]).toEqual([DOCTOR, SLOT, APPT]);
  });

  it('defaults the exclusion to null when omitted', async () => {
    const executor = executorReturning([{ appointment_id: null }]);
    await Appointment.findConflict(executor, DOCTOR, SLOT);
    expect(executor.query.mock.calls[0][1]).toEqual([DOCTOR, SLOT, null]);
  });

  it('reports a clash in the shape callers already read', async () => {
    // Callers use conflict.appointment_id for the 409 response body.
    const executor = executorReturning([{ appointment_id: APPT }]);
    const conflict = await Appointment.findConflict(executor, DOCTOR, SLOT);
    expect(conflict).toEqual({ appointment_id: APPT, scheduled_at: SLOT });
  });

  it('returns null when the slot is free', async () => {
    const executor = executorReturning([{ appointment_id: null }]);
    await expect(Appointment.findConflict(executor, DOCTOR, SLOT)).resolves.toBeNull();
  });

  it('returns null rather than throwing when the helper yields no row at all', async () => {
    const executor = executorReturning([]);
    await expect(Appointment.findConflict(executor, DOCTOR, SLOT)).resolves.toBeNull();
  });
});
