# syntax=docker/dockerfile:1

# ── Build stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Runtime stage ────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Non-root, non-login user — the container never runs as root, limiting
# blast radius if the Node process is ever compromised (Chapter 4 §4.3.8.4).
#
# Also removes npm/npx, which are never invoked in this stage (CMD below
# calls `node` directly, never `npm start`). This isn't just cleanup:
# node:20-alpine's bundled npm ships its own copy of node-tar (currently
# 6.2.1, at /usr/local/lib/node_modules/npm/node_modules/tar — confirmed by
# pulling the actual image), which is where CVE-2026-59873 (CRITICAL)
# showed up in a live Trivy scan on 2026-07-30. It's not in
# package-lock.json anywhere — npm's internal tooling has nothing to do
# with this application's own dependency tree — so removing npm/npx here
# eliminates the CVE from the image at its actual source, instead of
# suppressing a finding that isn't really about anything this container
# runs.
RUN addgroup -S pdms && adduser -S pdms -G pdms \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Amazon RDS regional CA bundle. Node's own bundled trust store does not
# include RDS's CA (rds-ca-rsa2048-g1 chains to a private AWS root), so
# src/config/database.js's ssl.rejectUnauthorized = true would reject
# every connection without this. Only read when DB_SSL=true — i.e. in the
# deployed container (modules/ec2/templates/deploy.sh.tpl sets it); local
# dev runs with DB_SSL=false and never touches this file.
# ADD with a URL needs no curl/wget installed in the image. --chmod=644 is
# required, not cosmetic: a URL-sourced ADD lands as root-owned mode 600
# (Dockerfile reference, "Adding files from a URL"), which the non-root
# pdms user below could not read.
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/rds-global-bundle.pem

# src/middleware/upload.js creates this directory at require-time
# (fs.mkdirSync), and routes.js requires it during startup route
# registration — not lazily. Every COPY above lands root-owned since none
# use --chown, so without this the non-root pdms user below gets EACCES
# before the process ever binds to a port.
RUN mkdir -p /app/uploads && chown -R pdms:pdms /app/uploads

USER pdms

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:5000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/server.js"]
