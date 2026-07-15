# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies needed for compiling C++ native modules (like sharp/node-gyp)
RUN apk add --no-cache python3 make g++ gcc

# Copy package files
COPY package*.json ./

# Install dependencies (ignoring optional sharp platform prebuild lookup timeouts if any, or letting node-gyp build it)
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1
RUN npm ci --omit=dev

# Final stage
FROM node:22-alpine

WORKDIR /app

# Runtime dependencies
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    ca-certificates \
    curl


# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs && chmod 755 logs

# Set production environment
ENV NODE_ENV=production

# Infisical SDK credentials — supply at runtime via -e or docker-compose
# Never bake real values into the image
ENV INFISICAL_UNIVERSAL_AUTH_CLIENT_ID="" \
    INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET="" \
    INFISICAL_PROJECT_ID="" \
    INFISICAL_ENV="prod" \
    INFISICAL_PATH="/" \
    INFISICAL_SITE_URL="https://app.infisical.com"

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/api', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application (Infisical SDK loads secrets at boot via server.js)
CMD ["node", "--max-old-space-size=400", "--expose-gc", "server.js"]
