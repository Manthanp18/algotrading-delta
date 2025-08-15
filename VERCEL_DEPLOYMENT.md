# 🚀 Vercel Deployment Guide

This guide will help you deploy both the backend API and frontend dashboard to Vercel.

## 📋 Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Vercel CLI**: Install globally
   ```bash
   npm install -g vercel
   ```
3. **Git Repository**: Push your code to GitHub/GitLab/Bitbucket

## 🎯 Deployment Strategy

We'll deploy as **two separate projects**:
1. **Backend API** - Serverless functions
2. **Frontend Dashboard** - Next.js app

## 📦 Part 1: Deploy Backend API

### Step 1: Prepare Backend
```bash
cd backend
```

### Step 2: Install Vercel CLI (if not installed)
```bash
npm install -g vercel
```

### Step 3: Deploy Backend
```bash
vercel
```

Follow the prompts:
- **Set up and deploy?** → Yes
- **Which scope?** → Your account
- **Link to existing project?** → No (create new)
- **Project name?** → `trading-backend` (or your choice)
- **Directory?** → `./`
- **Override settings?** → No

### Step 4: Set Environment Variables

After deployment, go to Vercel Dashboard:

1. Navigate to your backend project
2. Go to **Settings** → **Environment Variables**
3. Add the following:

```
DELTA_API_KEY=your_delta_api_key
DELTA_API_SECRET=your_delta_api_secret
DELTA_BASE_URL=https://api.delta.exchange
NODE_ENV=production
```

### Step 5: Note Your Backend URL

Your backend will be deployed at:
```
https://trading-backend.vercel.app
```
(Save this URL - you'll need it for frontend)

## 🎨 Part 2: Deploy Frontend Dashboard

### Step 1: Prepare Frontend
```bash
cd ../frontend
```

### Step 2: Update Environment Variables

Create/edit `.env.production`:
```env
NEXT_PUBLIC_API_URL=https://trading-backend.vercel.app
NEXT_PUBLIC_WS_URL=wss://trading-backend.vercel.app
NEXT_PUBLIC_ENVIRONMENT=production
```

### Step 3: Deploy Frontend
```bash
vercel
```

Follow the prompts:
- **Set up and deploy?** → Yes
- **Which scope?** → Your account
- **Link to existing project?** → No (create new)
- **Project name?** → `trading-dashboard` (or your choice)
- **Directory?** → `./`
- **Override settings?** → No

### Step 4: Set Environment Variables

In Vercel Dashboard for frontend:

1. Go to **Settings** → **Environment Variables**
2. Add:

```
NEXT_PUBLIC_API_URL=https://trading-backend.vercel.app
NEXT_PUBLIC_WS_URL=wss://trading-backend.vercel.app
NEXT_PUBLIC_ENVIRONMENT=production
```

## 🔧 Alternative: Using Vercel Dashboard

### Deploy via GitHub Integration

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Ready for Vercel deployment"
   git push origin main
   ```

2. **Import in Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Click **Import Git Repository**
   - Select your repository

3. **Configure Backend**:
   - Root Directory: `backend`
   - Framework Preset: Other
   - Build Command: `npm install`
   - Output Directory: `./`

4. **Configure Frontend** (separate project):
   - Root Directory: `frontend`
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`

## 🌐 Production URLs

After deployment, you'll have:

- **Backend API**: `https://your-backend.vercel.app`
  - Health: `/health`
  - Session: `/api/session`
  - Trades: `/api/trades`
  - Analytics: `/api/analytics`

- **Frontend Dashboard**: `https://your-frontend.vercel.app`
  - Main dashboard with live trading data

## 🔄 Continuous Deployment

### Automatic Deployments

Once connected to Git:
- **Production**: Deploys on push to `main` branch
- **Preview**: Deploys on pull requests

### Manual Redeploy
```bash
# Backend
cd backend
vercel --prod

# Frontend
cd frontend
vercel --prod
```

## ⚠️ Important Considerations

### 1. Serverless Limitations

Vercel functions have:
- **Execution timeout**: 10 seconds (Free), 60 seconds (Pro)
- **No persistent storage**: Use external database
- **No WebSocket support**: Use polling or external service

### 2. Data Persistence

Since Vercel is serverless, you need external storage:

**Option A: Use Vercel KV (Redis)**
```javascript
// Install: npm install @vercel/kv
import { kv } from '@vercel/kv';

// Save trade
await kv.set(`trade_${date}`, tradeData);

// Get trade
const trade = await kv.get(`trade_${date}`);
```

**Option B: Use MongoDB Atlas**
```javascript
// Install: npm install mongodb
import { MongoClient } from 'mongodb';

const client = new MongoClient(process.env.MONGODB_URI);
```

**Option C: Use Supabase**
```javascript
// Install: npm install @supabase/supabase-js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);
```

### 3. Live Trading Considerations

For continuous trading bot:
- Vercel functions timeout after 10-60 seconds
- Consider using external services:
  - **Railway** for always-on backend
  - **Heroku** for persistent processes
  - **AWS EC2** for full control

## 🔍 Monitoring

### Vercel Dashboard Features
- **Functions**: Monitor API calls
- **Analytics**: Track performance
- **Logs**: Debug issues
- **Domains**: Custom domain setup

### Add Custom Domain
1. Go to project settings
2. Navigate to **Domains**
3. Add your domain
4. Update DNS records

## 🐛 Troubleshooting

### Backend Issues

**Error: Functions timeout**
- Optimize code for faster execution
- Use caching for repeated data
- Consider upgrading to Pro for longer timeout

**Error: CORS issues**
- Backend already has CORS enabled
- Check frontend API URL is correct

### Frontend Issues

**Error: API connection failed**
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check backend is deployed and running
- Review browser console for errors

**Error: Build failed**
- Check all dependencies are in `package.json`
- Verify TypeScript has no errors
- Review build logs in Vercel

## 📝 Environment Variables Summary

### Backend (.env)
```env
NODE_ENV=production
DELTA_API_KEY=your_key
DELTA_API_SECRET=your_secret
DELTA_BASE_URL=https://api.delta.exchange

# Optional: Database
MONGODB_URI=mongodb+srv://...
REDIS_URL=redis://...
```

### Frontend (.env.production)
```env
NEXT_PUBLIC_API_URL=https://your-backend.vercel.app
NEXT_PUBLIC_WS_URL=wss://your-backend.vercel.app
NEXT_PUBLIC_ENVIRONMENT=production
```

## 🚀 Quick Deploy Script

Create `deploy.sh` in root:
```bash
#!/bin/bash

echo "🚀 Deploying to Vercel..."

# Deploy backend
echo "📦 Deploying backend..."
cd backend
vercel --prod

# Deploy frontend
echo "🎨 Deploying frontend..."
cd ../frontend
vercel --prod

echo "✅ Deployment complete!"
```

Make executable and run:
```bash
chmod +x deploy.sh
./deploy.sh
```

## 🎉 Success!

Your trading system is now live on Vercel! 

Access your dashboard at:
- Frontend: `https://your-frontend.vercel.app`
- Backend API: `https://your-backend.vercel.app/health`

## 📚 Next Steps

1. **Set up monitoring**: Use Vercel Analytics
2. **Add error tracking**: Integrate Sentry
3. **Configure alerts**: Set up notifications
4. **Optimize performance**: Use caching strategies
5. **Scale as needed**: Upgrade plan for more resources

---

**Note**: For production trading with real money, consider using a dedicated server or cloud service with persistent connections and proper error handling.