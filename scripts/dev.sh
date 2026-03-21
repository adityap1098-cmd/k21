#!/bin/bash
# Start K21 dev environment
# Usage: bash scripts/dev.sh

export PATH="$HOME/AppData/Local/Microsoft/WinGet/Links:$HOME/AppData/Roaming/fnm:$PATH"
eval "$(fnm env --shell bash)" 2>/dev/null
fnm use 22 2>/dev/null

export DATABASE_URL="postgres://appuser:k21devpass@localhost:5433/k21"
export REDIS_URL="redis://:k21redisdev@localhost:6379"
export JWT_SECRET="dev-secret-k21-not-for-production-use-only"
export NODE_ENV=development
export PORT=3001

echo "Starting API on :3001..."
cd apps/api
node --import tsx/esm src/index.ts &
API_PID=$!
cd ../..

sleep 2

echo "Starting Web on :3000..."
cd apps/web
API_URL=http://localhost:3001 npx next dev -p 3000 &
WEB_PID=$!
cd ../..

echo ""
echo "==================================="
echo "  K21 ERP Development Environment"
echo "==================================="
echo "  Web:  http://localhost:3000"
echo "  API:  http://localhost:3001"
echo "  Login: admin@k21.id / admin123"
echo "==================================="
echo ""
echo "Press Ctrl+C to stop all services"

trap "kill $API_PID $WEB_PID 2>/dev/null; exit" INT TERM
wait
