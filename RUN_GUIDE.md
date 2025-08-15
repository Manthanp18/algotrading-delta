# 🚀 Quick Start Guide - How to Run the Trading System

## Prerequisites
1. **Node.js 18+** installed
2. **Delta Exchange API credentials** (for live trading)

## 🎯 Quick Start (Recommended)

### Step 1: Setup (First time only)
```bash
./setup.sh
```

### Step 2: Configure API (Optional - for live trading)
```bash
# Edit backend/.env file and add your Delta Exchange credentials:
DELTA_API_KEY=your_api_key_here
DELTA_API_SECRET=your_api_secret_here
DELTA_BASE_URL=https://api.delta.exchange
```

### Step 3: Run Both Services
```bash
./run-both.sh
```

## 🌐 Access Points

Once running:
- **📊 Frontend Dashboard**: http://localhost:3001
- **🔧 Backend API**: http://localhost:3000
- **❤️ Health Check**: http://localhost:3000/health

## 🎮 Running Individual Services

### Backend Only
```bash
./run-backend.sh
# OR manually:
cd backend
npm install
npm run start:dev
```

### Frontend Only
```bash
./run-frontend.sh
# OR manually:
cd frontend
npm install
npm run dev
```

## 📝 Available Backend Commands

```bash
cd backend

# Live trading simulation (no API key required)
npm run live

# Run backtest
npm run backtest

# View results
npm run results

# Use CLI
npm run cli
```

## 🛑 Stopping Services

Press **`Ctrl+C`** in the terminal to stop services.

## ⚠️ Troubleshooting

### Error: Cannot find module
```bash
# Reinstall dependencies
cd backend && npm install
cd ../frontend && npm install
```

### Port already in use
```bash
# Kill processes on ports
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

### API Authentication Error
- Check your Delta Exchange credentials in `backend/.env`
- The system works in simulation mode without credentials

## 📁 Project Structure

```
AlgoMCP/
├── backend/          # All backend code
│   ├── src/          # TypeScript source (new)
│   ├── legacy-src/   # JavaScript source (legacy)
│   └── package.json  # Backend dependencies
├── frontend/         # All frontend code
│   ├── src/          # Next.js source
│   └── package.json  # Frontend dependencies
└── run-both.sh       # Quick start script
```

## 🎯 That's it!

Just run `./run-both.sh` and you're ready to trade! 🚀