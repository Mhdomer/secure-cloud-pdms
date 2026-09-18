'use strict';

// database.js builds its Pool config at require time, so each case needs a
// fresh module registry. pg is mocked to capture the config it receives.
const capturedConfigs = [];

jest.mock('pg', () => ({
  Pool: jest.fn(function PoolMock(config) {
    capturedConfigs.push(config);
    this.on = jest.fn();
    this.connect = jest.fn();
  }),
}));
jest.mock('../logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }));
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(() => 'FAKE-RDS-CA-BUNDLE'),
}));

function loadWith(env) {
  capturedConfigs.length = 0;
  jest.isolateModules(() => {
    Object.assign(process.env, {
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_NAME: 'pdms',
      DB_USER: 'pdms_app',
      DB_PASSWORD: 'unused-by-the-mock',
    }, env);
    require('../database');
  });
  return capturedConfigs[0];
}

afterEach(() => {
  delete process.env.DB_SSL;
  delete process.env.DB_SSL_MODE;
});

describe('database TLS configuration', () => {
  it('disables TLS when DB_SSL is not "true" — unchanged local behaviour', () => {
    const config = loadWith({ DB_SSL: 'false' });
    expect(config.ssl).toBe(false);
  });

  it('uses the RDS CA bundle when DB_SSL=true and no mode is given', () => {
    // The production invariant: absent DB_SSL_MODE, this is exactly today's path.
    const config = loadWith({ DB_SSL: 'true' });
    expect(config.ssl.rejectUnauthorized).toBe(true);
    expect(config.ssl.ca).toBe('FAKE-RDS-CA-BUNDLE');
  });

  it('verifies against the public trust store when DB_SSL_MODE=standard', () => {
    const config = loadWith({ DB_SSL: 'true', DB_SSL_MODE: 'standard' });
    expect(config.ssl.rejectUnauthorized).toBe(true);
    expect(config.ssl.ca).toBeUndefined();
  });

  it('never disables certificate verification in any mode', () => {
    // Guards against a future "just make it work" edit.
    for (const mode of [undefined, 'standard']) {
      const config = loadWith({ DB_SSL: 'true', DB_SSL_MODE: mode });
      expect(config.ssl.rejectUnauthorized).toBe(true);
    }
  });
});
