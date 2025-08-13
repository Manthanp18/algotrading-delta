#!/bin/bash

echo "🚀 Universal Deployment Script"
echo "=============================="

# Check if git is set up
if [ ! -d .git ]; then
    echo "📝 Setting up Git..."
    git init
    git add .
    git commit -m "Initial commit: Live trading system ready for deployment"
fi

echo ""
echo "🎯 Choose your deployment platform:"
echo "1. Render (Recommended - $7/month)"
echo "2. Heroku (Popular - $7/month)" 
echo "3. DigitalOcean ($5/month)"
echo "4. Vercel (Free - Limited)"
echo ""

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo ""
        echo "🌟 RENDER DEPLOYMENT"
        echo "==================="
        echo "1. Push your code to GitHub:"
        echo "   git remote add origin https://github.com/YOUR_USERNAME/live-trading-system.git"
        echo "   git push -u origin main"
        echo ""
        echo "2. Go to render.com and sign up"
        echo ""
        echo "3. Create New Web Service:"
        echo "   - Connect GitHub"
        echo "   - Select your repository"
        echo "   - Build Command: npm install"
        echo "   - Start Command: node server-live.js"
        echo ""
        echo "4. Add Environment Variables:"
        echo "   NODE_ENV=production"
        echo "   DELTA_API_KEY=ds0uiXS61VyO7E1TZHHs8452t5SvHd"
        echo "   DELTA_API_SECRET=VklXrEFVl5TtyIzH73qNhBIkSixoL57sJcxL4qRi3tT0COitYqm1iAYf5ogx"
        echo "   DELTA_BASE_URL=https://api.india.delta.exchange"
        echo "   TRADING_SYMBOL=BTCUSD"
        echo "   INITIAL_CAPITAL=50000"
        echo ""
        echo "5. Deploy! Your dashboard will be at: https://your-app.onrender.com"
        ;;
        
    2)
        echo ""
        echo "🔥 HEROKU DEPLOYMENT"
        echo "==================="
        echo "1. Install Heroku CLI: brew install heroku (Mac) or download from heroku.com"
        echo ""
        echo "2. Login and create app:"
        echo "   heroku login"
        echo "   heroku create your-trading-app-name"
        echo ""
        echo "3. Set environment variables:"
        cat << 'EOF'
   heroku config:set NODE_ENV=production
   heroku config:set DELTA_API_KEY=ds0uiXS61VyO7E1TZHHs8452t5SvHd
   heroku config:set DELTA_API_SECRET=VklXrEFVl5TtyIzH73qNhBIkSixoL57sJcxL4qRi3tT0COitYqm1iAYf5ogx
   heroku config:set DELTA_BASE_URL=https://api.india.delta.exchange
   heroku config:set TRADING_SYMBOL=BTCUSD
   heroku config:set INITIAL_CAPITAL=50000
EOF
        echo ""
        echo "4. Deploy:"
        echo "   git push heroku main"
        echo ""
        echo "5. Your dashboard will be at: https://your-trading-app-name.herokuapp.com"
        ;;
        
    3)
        echo ""
        echo "🌊 DIGITALOCEAN DEPLOYMENT"
        echo "=========================="
        echo "1. Push to GitHub first:"
        echo "   git remote add origin https://github.com/YOUR_USERNAME/live-trading-system.git"
        echo "   git push -u origin main"
        echo ""
        echo "2. Go to cloud.digitalocean.com"
        echo ""
        echo "3. Apps → Create App → GitHub → Select your repo"
        echo ""
        echo "4. Add Environment Variables in dashboard:"
        echo "   NODE_ENV=production"
        echo "   DELTA_API_KEY=ds0uiXS61VyO7E1TZHHs8452t5SvHd"
        echo "   DELTA_API_SECRET=VklXrEFVl5TtyIzH73qNhBIkSixoL57sJcxL4qRi3tT0COitYqm1iAYf5ogx"
        echo "   DELTA_BASE_URL=https://api.india.delta.exchange"
        echo "   TRADING_SYMBOL=BTCUSD"
        echo "   INITIAL_CAPITAL=50000"
        echo ""
        echo "5. Deploy! Dashboard: https://your-app.ondigitalocean.app"
        ;;
        
    4)
        echo ""
        echo "⚡ VERCEL DEPLOYMENT (FREE)"
        echo "=========================="
        echo "1. Install Vercel CLI:"
        echo "   npm install -g vercel"
        echo ""
        echo "2. Deploy:"
        echo "   vercel"
        echo "   (Follow the prompts)"
        echo ""
        echo "3. Set environment variables:"
        echo "   vercel env add DELTA_API_KEY"
        echo "   vercel env add DELTA_API_SECRET"
        echo "   vercel env add TRADING_SYMBOL"
        echo "   vercel env add INITIAL_CAPITAL"
        echo ""
        echo "4. Redeploy with env vars:"
        echo "   vercel --prod"
        echo ""
        echo "⚠️  Note: Vercel has 10-second timeout limits"
        echo "5. Dashboard: https://your-app.vercel.app"
        ;;
        
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "🎉 Deployment instructions ready!"
echo ""
echo "📊 After deployment, your live trading dashboard will show:"
echo "   - Real-time portfolio metrics"
echo "   - Live trade history"
echo "   - System status and uptime"
echo "   - Mobile-responsive interface"
echo ""
echo "🔄 Your confluenceScalpingStrategy will run 24/7 and execute trades automatically!"
echo ""
echo "📱 Monitor from anywhere: Check your deployment URL on mobile/desktop"
echo ""

# Show current git status
echo "📋 Current Git Status:"
git status --porcelain
if [ $? -eq 0 ]; then
    echo "✅ Git repository ready"
else
    echo "⚠️  Please commit your changes first"
fi