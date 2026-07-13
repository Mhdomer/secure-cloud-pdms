'use strict';

const logger = require('../config/logger');

/**
 * CORS is restricted to a single allow-listed origin — the CloudFront
 * distribution serving the React SPA (Chapter 4 §4.3.8.3). `credentials:
 * true` is required so the httpOnly JWT cookie is sent cross-origin between
 * the CloudFront origin and the ALB origin.
 */
function buildCorsOptions() {
  const allowedOrigin = process.env.CLOUDFRONT_ORIGIN;

  if (!allowedOrigin) {
    throw new Error('Missing required environment variable: CLOUDFRONT_ORIGIN');
  }

  return {
    origin(origin, callback) {
      // `origin` is undefined for same-origin/non-browser requests (e.g.
      // server-to-server health checks) — allow those through; browsers
      // always send an Origin header for cross-origin fetch/XHR, so this
      // does not weaken the browser-enforced CORS boundary.
      if (!origin || origin === allowedOrigin) {
        return callback(null, true);
      }
      logger.warn('Blocked CORS request from disallowed origin', { origin });
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type'],
    optionsSuccessStatus: 200,
  };
}

module.exports = { buildCorsOptions };
