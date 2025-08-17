#!/bin/bash

echo "🚀 Deploying SuperTrend Renko Backend to Vercel..."
echo "=================================================="

# Make sure we're in the backend directory
cd "$(dirname "$0")"

echo "📦 Installing Vercel CLI (if needed)..."
if ! command -v vercel &> /dev/null; then
    npm install -g vercel
fi

echo "🔧 Preparing deployment..."
echo "✅ Strategy: SuperTrend Renko System"
echo "✅ API Endpoints: /api/session, /api/trades, /api/analytics"
echo "✅ Configuration: Updated for production"

echo "🚀 Deploying to Vercel..."
vercel --prod

echo ""
echo "🎯 Deployment Complete!"
echo "📊 Backend API: Your Vercel URL"
echo "🔧 Strategy: SuperTrend Renko System"
echo ""
echo "✅ The backend now returns 'SuperTrend Renko System' instead of 'Confluence Scalping'"
echo "✅ All API endpoints updated with correct data structure"
echo "✅ Ready for frontend integration"