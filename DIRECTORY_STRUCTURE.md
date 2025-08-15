# 📁 Clean Directory Structure

## Root Directory
```
AlgoMCP/                          # Project root
├── backend/                      # ✅ All backend code and configuration
├── frontend/                     # ✅ All frontend code and configuration
├── .env.example                  # Environment variables template
├── .git/                         # Git repository
├── CLAUDE.md                     # Project instructions for Claude
├── PROJECT_STRUCTURE.md          # Detailed architecture documentation
├── README.md                     # Main project documentation
├── DIRECTORY_STRUCTURE.md        # This file - clean structure overview
├── run-backend.sh               # 🚀 Start backend only
├── run-frontend.sh              # 🚀 Start frontend only  
├── run-both.sh                  # 🚀 Start both services
└── setup.sh                    # 🔧 Automated project setup
```

## Backend Directory (`backend/`)
```
backend/
├── src/                         # ✅ Modern TypeScript source code
│   ├── app/                     # Application layer
│   ├── config/                  # Configuration management
│   ├── core/                    # Business logic (engines, portfolio, risk)
│   ├── data/                    # Data providers and repositories
│   ├── strategies/              # Trading strategies
│   ├── types/                   # TypeScript definitions
│   ├── utils/                   # Utility functions
│   └── index.ts                 # Application entry point
├── legacy-src/                  # ✅ Legacy JavaScript files (preserved)
├── dashboard/                   # ✅ Simple HTML dashboard (legacy)
├── deprecated-files/            # ✅ Old test files
├── logs/                        # ✅ Trading logs
├── .env                         # ✅ Environment variables
├── .env.example                 # ✅ Environment template
├── .gitignore                   # ✅ Git ignore rules
├── .dockerignore                # ✅ Docker ignore rules
├── Dockerfile                   # ✅ Docker configuration
├── package.json                 # ✅ Dependencies and scripts
├── tsconfig.json               # ✅ TypeScript configuration
├── cli.js                      # ✅ Command line interface
├── index.js                    # ✅ Legacy entry point
├── *.js                        # ✅ All JavaScript files moved here
├── *.json                      # ✅ All deployment configs moved here
└── *.sh                        # ✅ All deployment scripts moved here
```

## Frontend Directory (`frontend/`)
```
frontend/
├── src/                         # ✅ Next.js 15 source code
│   ├── app/                     # App Router pages
│   ├── components/              # React components
│   ├── hooks/                   # Custom React hooks
│   ├── lib/                     # Utility libraries
│   ├── types/                   # TypeScript definitions
│   └── utils/                   # Utility functions
├── public/                      # ✅ Static assets
├── .next/                       # ✅ Build output
├── node_modules/                # ✅ Dependencies
├── package.json                 # ✅ Dependencies and scripts
├── package-lock.json            # ✅ Lock file
├── next.config.ts               # ✅ Next.js configuration
├── tsconfig.json               # ✅ TypeScript configuration
├── tailwind.config.js          # ✅ Tailwind CSS configuration
├── eslint.config.mjs           # ✅ ESLint configuration
├── README.md                   # ✅ Frontend documentation
└── start-dashboard.sh          # ✅ Legacy start script
```

## Quick Start Commands

### 🚀 Simple Start (Recommended)
```bash
# Setup everything
./setup.sh

# Start both backend (port 3000) and frontend (port 3001)
./run-both.sh
```

### 🔧 Individual Services
```bash
# Backend only
./run-backend.sh

# Frontend only  
./run-frontend.sh
```

## Key Improvements ✅

1. **Clean Separation**: All backend code in `backend/`, all frontend code in `frontend/`
2. **No Root Clutter**: Only essential files in root directory
3. **Simple Scripts**: Easy-to-use run scripts for quick development
4. **Preserved Legacy**: All existing functionality maintained
5. **Clear Documentation**: Easy to understand structure

## File Organization Rules

### ✅ What's in Root
- Run scripts (`run-*.sh`)
- Setup script (`setup.sh`)
- Documentation files (`*.md`)
- Project configuration (`.env.example`)
- Git repository (`.git/`)

### ✅ What's in Backend  
- All JavaScript/TypeScript backend code
- All deployment configurations
- All environment files
- All Docker configurations
- All CLI tools
- All logs and data

### ✅ What's in Frontend
- All Next.js/React code
- All frontend configurations
- All static assets
- All frontend documentation

This structure follows enterprise standards and makes the codebase much easier to navigate and maintain! 🎉