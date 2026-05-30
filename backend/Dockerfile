# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including optional ones for sharp, ffmpeg, etc.)
RUN npm ci --omit=dev

# Final stage
FROM node:22-alpine

WORKDIR /app

# Install runtime dependencies (FFmpeg for media processing)
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs && chmod 755 logs

# Set production environment
ENV NODE_ENV=production

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/api', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application with memory constraints
CMD ["node", "--max-old-space-size=400", "--expose-gc", "index.js"]
