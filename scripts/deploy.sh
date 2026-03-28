#!/bin/bash
# ============================================================================
# K21 Deploy Script — Git-based + PM2
# Usage: bash scripts/deploy.sh
# ============================================================================

set -e

cd /opt/k21

echo "=== K21 Deploy ==="
echo ""

# 1. Pull latest
echo "📥 Pulling latest from GitHub..."
git pull origin master
echo ""

# 2. Install deps (only if lockfile changed)
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
echo ""

# 3. Build API
echo "🔨 Building API..."
pnpm --filter @k21/api build
echo ""

# 4. Build Web
echo "🔨 Building Web..."
pnpm --filter @k21/web build
echo ""

# 5. Restart PM2
echo "🔄 Restarting services..."
pm2 restart k21-api --update-env
pm2 restart k21-web --update-env
echo ""

# 6. Status
echo "✅ Deploy selesai!"
echo ""
pm2 status
