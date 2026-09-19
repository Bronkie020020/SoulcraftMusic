# Multi-stage Dockerfile for Soulcraft Downloader with FFmpeg support
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install FFmpeg and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    python3 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production Runner
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# Install FFmpeg and runtime requirements
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    python3 \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=10000

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

EXPOSE 10000

CMD ["node", "dist/server.cjs"]
