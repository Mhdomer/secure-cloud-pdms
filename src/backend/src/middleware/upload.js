'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

function isAllowed(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  return ALLOWED_MIME_TYPES.includes(file.mimetype) && ALLOWED_EXTENSIONS.includes(ext);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  // Generated server-side, never derived from the caller-supplied path —
  // fileFilter has already confirmed the extension is one of the four
  // allowed values by the time this runs.
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}${ext}`;
    cb(null, unique);
  },
});

function fileFilter(req, file, cb) {
  if (!isAllowed(file)) {
    const err = new Error('Only PDF, JPG, JPEG, and PNG files are allowed');
    err.statusCode = 400;
    return cb(err);
  }
  return cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const uploadSingle = upload.single('file');
const uploadMultiple = upload.array('files', 5);

module.exports = { uploadSingle, uploadMultiple, UPLOAD_DIR };
