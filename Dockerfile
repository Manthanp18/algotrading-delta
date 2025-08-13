# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory in container
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p dashboard/trades logs

# Expose the port the app runs on
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S trading -u 1001

# Change ownership of app directory to nodejs user
RUN chown -R trading:nodejs /app
USER trading

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); \
               http.get('http://localhost:3000/api/health', (res) => { \
                 process.exit(res.statusCode === 200 ? 0 : 1); \
               }).on('error', () => process.exit(1));"

# Start the application
CMD ["node", "server-live.js", "BTCUSD", "50000", "3000"]