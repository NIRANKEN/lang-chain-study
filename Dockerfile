# Build stage
FROM node:24-slim AS builder

# Enable corepack for pnpm
RUN corepack enable

WORKDIR /app

# Copy package files (package.json contains packageManager field)
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Production stage
FROM node:24-slim

# Enable corepack for pnpm
RUN corepack enable

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 8080

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Start the application
CMD ["node", "dist/index.js"]
