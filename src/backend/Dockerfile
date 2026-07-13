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

USER pdms

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:5000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/server.js"]
