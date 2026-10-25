# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Builder
# Installs ALL dependencies (including devDependencies) and compiles TypeScript
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder

# Install build essentials needed by some native node modules
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests first (layer-caches npm install)
COPY package*.json ./

# Install all deps (devDeps needed for `nest build`)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Compile TypeScript → dist/
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Runtime
# Copies only compiled output + production dependencies; keeps image lean
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

# Security: run as non-root user
RUN groupadd --system handla && useradd --system --gid handla --home-dir /app handla

WORKDIR /app

# Copy production dependency manifests
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

# Copy compiled application from builder stage
COPY --from=builder /app/dist ./dist

# Copy Handlebars email templates (not included in nest build output by default)
COPY --from=builder /app/src/modules/email/templates ./dist/modules/email/templates

# Copy seed-asset images (real project logos) used by the attach-project-logos
# seeder. These are UPLOAD SOURCE ONLY — the seeder pushes them to S3 and stores
# the resulting public URL on the DB row; the app never serves them directly.
COPY --from=builder /app/scripts ./scripts

# Copy entrypoint script
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Create logs directory and give the non-root user full ownership of /app
# (Winston File transport calls mkdirSync('logs') at startup — must succeed
#  before we drop root privileges with USER handla)
RUN mkdir -p /app/logs && chown -R handla:handla /app

# Switch to non-root user
USER handla

# Expose the API port (default 3001, overridable via PORT env var)
EXPOSE 3001

# Health-check: poll /api/health every 30 s, allow 10 s to respond.
# Use 127.0.0.1 (not localhost) to force IPv4 — in Alpine, localhost may resolve
# to IPv6 ::1 first, where the server (bound to 0.0.0.0) is not listening.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e 'const http=require("node:http");const port=process.env.PORT||3001;const req=http.get({host:"127.0.0.1",port,path:"/api/health",timeout:8000},res=>{res.resume();process.exit(res.statusCode===200?0:1)});req.on("error",()=>process.exit(1));req.on("timeout",()=>{req.destroy();process.exit(1)})'
ENTRYPOINT ["./entrypoint.sh"]
