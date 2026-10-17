#!/bin/sh
set -e

echo "=========================================================="
echo "🚀 QuantumRisk Analyzer Production Container Initializing"
echo "=========================================================="

# Start Python Scanner microservice in background
echo "Starting Python SSLyze Scanner microservice on port 5000..."
python3 python-scanner/main.py &

# Wait briefly for Python microservice to bind port 5000
sleep 2

# Push database migrations / ensure sqlite schema is ready
cd /app/backend
npx prisma db push --skip-generate

# Start Node API server
echo "Starting Backend Express API server on port ${PORT:-10000}..."
exec npm start
