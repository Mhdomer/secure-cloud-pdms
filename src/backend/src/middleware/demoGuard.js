'use strict';

/**
 * Refuses a route that cannot work in the hosted demonstration build.
 *
 * Used for file upload and download, which need durable storage that the
 * demo deployment does not have — Vercel's filesystem is ephemeral, and
 * object storage is deliberately out of scope
 * (docs/superpowers/specs/2026-09-18-vercel-demo-build-design.md). Refusing
 * explicitly beats a 500 from a failed write.
 *
 * Inert unless DEMO_MODE is exactly "true", so the production path is
 * unaffected.
 *
 * @param {string} feature - named in the response, e.g. "File upload"
 */
function blockInDemo(feature) {
  return function demoGuard(req, res, next) {
    if (process.env.DEMO_MODE === 'true') {
      return res.status(503).json({
        error: `${feature} is unavailable in the demonstration build. The full system supports it.`,
      });
    }
    return next();
  };
}

module.exports = { blockInDemo };
