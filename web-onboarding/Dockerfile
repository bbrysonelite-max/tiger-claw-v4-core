# Frontend Dockerfile for Tiger Claw (v4)
# Multi-stage build for optimized Cloud Run deployment

FROM node:22-slim AS builder
WORKDIR /app

# Copy lockfiles and install dependencies
COPY package*.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --no-frozen-lockfile

# Copy source and build
COPY . .
ARG _NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${_NEXT_PUBLIC_API_URL}
RUN pnpm build

# Production runner
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]
