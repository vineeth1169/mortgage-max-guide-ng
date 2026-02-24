# ────────────────────────────────────────────────────────────────────
# Loan Pool Advisor - Backend Microservice
# Rules API Server with audit logging and provenance tracking
# ────────────────────────────────────────────────────────────────────

FROM node:20-alpine

LABEL maintainer="Loan Pool Advisor Team"
LABEL version="1.0.0"
LABEL description="Rules API microservice for Loan Pool Advisor"

# Create app directory
WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY server.js ./
COPY data/ ./data/

# Create volume for persistent data
VOLUME ["/app/data"]

# Expose the API port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Run the server
CMD ["node", "server.js"]
