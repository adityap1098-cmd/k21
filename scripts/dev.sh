#!/bin/bash
# Start K21 dev environment
# Usage: bash scripts/dev.sh

export PATH="$HOME/AppData/Local/Microsoft/WinGet/Links:$HOME/AppData/Roaming/fnm:$PATH"
eval "$(fnm env --shell bash)"
fnm use 22

export DATABASE_URL="postgres://appuser:k21devpass@localhost:5433/k21"
export REDIS_URL="redis://localhost:6379"
export JWT_SECRET="dev-secret-k21-not-for-production-use-only"
export NODE_ENV=development

echo "Starting API on :3002..."
cd apps/api
node --import tsx/esm src/index.ts &
API_PID=$!
cd ../..

sleep 2

echo "Starting Web on :4000..."
cd apps/web
npx next dev -p 4000 &
WEB_PID=$!
cd ../..

echo ""
echo "==================================="
echo "  K21 ERP Development Environment"
echo "==================================="
echo "  Web:  http://localhost:4000"
echo "  API:  http://localhost:3002"
echo "  Login: admin@k21.id / admin123"
echo "==================================="
echo ""
echo "Press Ctrl+C to stop all services"

trap "kill $API_PID $WEB_PID 2>/dev/null; exit" INT TERM
wait
