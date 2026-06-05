# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Builder
# Installs ALL dependencies (including devDependencies) and compiles TypeScript
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Install build essentials needed by some native node modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy dependency manifests first (layer-caches npm install)
COPY package*.json ./

# Install all deps (devDeps needed for `nest build`)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Compile TypeScript → dist/
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Runtime
# Copies only compiled output + production dependencies; keeps image lean
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Security: run as non-root user
RUN addgroup -S handla && adduser -S handla -G handla

WORKDIR /app

# Copy production dependency manifests
COPY package*.json ./

# Install ONLY production dependencies
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# Copy compiled application from builder stage
COPY --from=builder /app/dist ./dist

# Copy Handlebars email templates (not included in nest build output by default)
COPY --from=builder /app/src/modules/email/templates ./dist/modules/email/templates

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

# Health-check: poll /api/health every 30 s, allow 10 s to respond
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3001}/api/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
