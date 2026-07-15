# ----------------------------
# Build stage
# ----------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Build dependencies
RUN apk add --no-cache python3 make g++ gcc

# Copy package files
COPY package*.json ./

ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1

# Install production dependencies
RUN npm ci --omit=dev


# ----------------------------
# Runtime stage
# ----------------------------
FROM node:22-alpine

WORKDIR /app

# Runtime dependencies
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    ca-certificates \
    curl \
    bash

# Install Infisical CLI
RUN curl -1sLf https://artifacts-cli.infisical.com/setup.alpine.sh | sh \
    && apk add --no-cache infisical

# Copy node_modules
COPY --from=builder /app/node_modules ./node_modules

# Copy application
COPY . .

# Create logs directory
RUN mkdir -p logs && chmod 755 logs

ENV NODE_ENV=production

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/api', r => process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Start through Infisical
CMD ["infisical", "run", "--", "node", "--max-old-space-size=400", "--expose-gc", "index.js"]