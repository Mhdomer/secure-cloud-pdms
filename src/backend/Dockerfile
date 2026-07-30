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
RUN addgroup -S pdms && adduser -S pdms -G pdms

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

USER pdms

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:5000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/server.js"]
