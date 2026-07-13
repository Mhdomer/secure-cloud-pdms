'use strict';

const winston = require('winston');

const level = process.env.LOG_LEVEL || 'info';
const isProd = process.env.NODE_ENV === 'production';

// NEVER log request bodies, passwords, tokens, or PHI. Route handlers must
// only pass structured metadata (ids, action names, status codes) to the
// logger — never req.body or database rows directly.
const logger = winston.createLogger({
  level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    isProd ? winston.format.json() : winston.format.combine(winston.format.colorize(), winston.format.simple())
  ),
  transports: [new winston.transports.Console()],
});

// In production, CloudWatch Logs Agent / ECS log driver tails stdout — no
// separate file transport is configured to avoid writing PHI-adjacent data
// to unencrypted local disk on the EC2 instance.

module.exports = logger;
