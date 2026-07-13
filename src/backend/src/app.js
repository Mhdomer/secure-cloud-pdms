'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { buildCorsOptions } = require('./middleware/corsValidator');
const { globalLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const apiRoutes = require('./routes');

const app = express();

// Behind the ALB (Chapter 4 §4.3.8.4) — required so req.ip / req.secure
// reflect the original client via X-Forwarded-* rather than the ALB itself,
// which also makes express-rate-limit key on the real client IP.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors(buildCorsOptions()));
app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));
app.use(globalLimiter);

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
