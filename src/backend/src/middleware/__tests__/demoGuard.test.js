'use strict';

const { blockInDemo } = require('../demoGuard');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

afterEach(() => {
  delete process.env.DEMO_MODE;
});

describe('blockInDemo', () => {
  it('passes through when DEMO_MODE is unset — the production invariant', () => {
    const next = jest.fn();
    const res = mockRes();
    blockInDemo('File upload')({}, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('refuses with 503 and names the feature when DEMO_MODE=true', () => {
    process.env.DEMO_MODE = 'true';
    const next = jest.fn();
    const res = mockRes();
    blockInDemo('File upload')({}, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json.mock.calls[0][0].error).toMatch(/File upload/);
    expect(res.json.mock.calls[0][0].error).toMatch(/demonstration/i);
  });

  it('requires the literal string "true"', () => {
    process.env.DEMO_MODE = '1';
    const next = jest.fn();
    blockInDemo('File upload')({}, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
