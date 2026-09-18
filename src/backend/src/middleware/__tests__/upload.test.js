'use strict';

const path = require('path');
const os = require('os');

// upload.js creates its directory at require time, so each case needs a fresh
// module registry with the environment already set.
function loadUploadModule(env) {
  let mod;
  jest.isolateModules(() => {
    const saved = process.env.UPLOAD_DIR;
    if (env.UPLOAD_DIR === undefined) {
      delete process.env.UPLOAD_DIR;
    } else {
      process.env.UPLOAD_DIR = env.UPLOAD_DIR;
    }
    mod = require('../upload');
    if (saved === undefined) {
      delete process.env.UPLOAD_DIR;
    } else {
      process.env.UPLOAD_DIR = saved;
    }
  });
  return mod;
}

describe('upload directory resolution', () => {
  it('defaults to the in-repo uploads directory when UPLOAD_DIR is unset', () => {
    // This is the production invariant: absent config means today's behaviour.
    const { UPLOAD_DIR } = loadUploadModule({ UPLOAD_DIR: undefined });
    expect(UPLOAD_DIR).toBe(path.join(__dirname, '../../../uploads'));
  });

  it('uses UPLOAD_DIR when set, so a read-only bundle does not crash the app', () => {
    const target = path.join(os.tmpdir(), 'pdms-upload-test');
    const { UPLOAD_DIR } = loadUploadModule({ UPLOAD_DIR: target });
    expect(UPLOAD_DIR).toBe(target);
  });
});
