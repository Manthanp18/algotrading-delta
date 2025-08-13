#!/bin/bash

echo "🚂 Railway Deployment Setup"
echo "=========================="

# Check if git is initialized
if [ ! -d .git ]; then
    echo "📝 Initializing Git repository..."
    git init
else
    echo "✅ Git repository already initialized"
fi

# Create .gitignore if it doesn't exist
if [ ! -f .gitignore ]; then
    echo "📝 Creating .gitignore..."
    cat > .gitignore << EOF
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime
.env
logs/
*.log
pids/
*.pid
*.seed
*.pid.lock

# Coverage
coverage/

# OS
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Backtest results (don't deploy)
backtest-results/

# Test files
test-*.js
debug-*.js
demo-*.js
working-live.js
simple-live.js
run-public-live.js

# Local trading data (will be recreated on server)
dashboard/trades/*.json

# Railway
.railway/
EOF
else
    echo "✅ .gitignore already exists"
fi

# Add all files
echo "📝 Adding files to Git..."
git add .

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo "✅ No changes to commit"
else
    echo "📝 Committing changes..."
    git commit -m "Ready for Railway deployment: Live trading system with minimal dashboard"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Create a GitHub repository named 'live-trading-system'"
echo "2. Run: git remote add origin https://github.com/YOUR_USERNAME/live-trading-system.git"
echo "3. Run: git push -u origin main"
echo "4. Go to railway.app and deploy from GitHub"
echo "5. Add your environment variables in Railway dashboard"
echo ""
echo "📊 Your trading system will be live at: https://your-app-name.up.railway.app"
echo ""
echo "✅ Setup complete! Ready for Railway deployment."