# Multi-stage Dockerfile for Next.js on Cloud Run

# 1) Builder image: install deps and build
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .

# Build-time public env for Next.js client bundle
ARG NEXT_PUBLIC_CHATKIT_WORKFLOW_ID=wf_68ee77a70ce08190a75e19e9b0a4f27f094b95735d6ec6b3
ENV NEXT_PUBLIC_CHATKIT_WORKFLOW_ID=${NEXT_PUBLIC_CHATKIT_WORKFLOW_ID}

# Disable Next telemetry for CI builds
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 2) Runtime image: minimal files to run standalone server
FROM node:20-bookworm-slim AS runner
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# Copy the standalone server and static assets from the builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Use a non-root user for security
USER node

EXPOSE 8080

CMD ["node", "server.js"]


