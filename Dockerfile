# ---------- Stage 1: Build ----------
FROM node:22-alpine AS builder

# Pin npm to the version that generated package-lock.json (avoids `npm ci` EUSAGE errors)
RUN npm install -g npm@11.5.2 --no-audit --no-fund

WORKDIR /usr/src/app

# Copy package files first (better caching)
COPY package*.json ./

# Install all dependencies (including dev); the npm cache is reused across builds via BuildKit
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# Copy source code
COPY . .

# Compile the app; the tsc incremental cache (node_modules/.cache) is reused across builds
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/usr/src/app/node_modules/.cache \
    npm run build

# Remove dev dependencies so only production deps are shipped
# (much faster than a second `npm ci --omit=dev` in the runtime stage)
RUN npm prune --omit=dev --no-audit --no-fund

# ---------- Stage 2: Production ----------
FROM node:22-alpine AS production

ENV NODE_ENV=production
WORKDIR /usr/src/app

# Copy production node_modules (already pruned), compiled output and package metadata
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/package-lock.json ./package-lock.json

# Expose port
EXPOSE 3000

# Run pending migrations, then start the API
CMD ["sh", "-c", "sleep 4 && npm run migration:run:prod && node dist/main.js"]
