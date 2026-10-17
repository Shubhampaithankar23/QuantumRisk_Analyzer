# Multi-runtime image: Node.js 20 + Python 3 for SSLyze & Node Express
FROM node:20-bookworm-slim

# Install Python 3, pip, and system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python scanner requirements
COPY python-scanner/requirements.txt ./python-scanner/
RUN pip3 install --no-cache-dir --break-system-packages -r python-scanner/requirements.txt
COPY python-scanner/ ./python-scanner/

# Setup backend
WORKDIR /app/backend
COPY backend/package*.json ./
COPY backend/prisma ./prisma/
RUN npm ci
RUN npx prisma generate

COPY backend/tsconfig.json ./
COPY backend/src ./src/
RUN npm run build

WORKDIR /app
COPY scripts/start-production.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 10000

ENV PORT=10000
ENV NODE_ENV=production
ENV PYTHON_SCANNER_URL=http://127.0.0.1:5000
ENV DATABASE_URL="file:./dev.db"

CMD ["./start.sh"]
