# --- Build stage: install deps and build the React client (Vite -> dist/client) ---
FROM node:20-alpine AS builder
WORKDIR /app

# Server dependencies (root has a lockfile -> reproducible install)
COPY package*.json ./
RUN npm ci

# Client dependencies (no committed lockfile yet -> npm install)
COPY client/package*.json ./client/
RUN cd client && npm install

COPY . .
# Build the frontend bundle to /app/dist/client (see client/vite.config.ts)
RUN cd client && npm run build

# --- Runtime stage ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# The server runs through tsx (handles ESM resolution + path aliases that a bare
# `node dist/server.js` would choke on); ship sources + the built client bundle.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npx", "tsx", "src/server.ts"]
