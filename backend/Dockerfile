# Use a slim Node.js 18 image for a smaller footprint
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package files first to leverage Docker's cache for dependencies
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on (matching your process.env.PORT)
EXPOSE 5000

# Set environment to production
ENV NODE_ENV=production

# Command to run the application
CMD ["npm", "start"]
