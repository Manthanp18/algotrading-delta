#!/bin/bash

echo "🚀 Vercel Deployment Script"
echo "=========================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if Vercel CLI is installed
if ! command_exists vercel; then
    echo -e "${YELLOW}⚠️  Vercel CLI not found. Installing...${NC}"
    npm install -g vercel
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install Vercel CLI${NC}"
        echo "Please install manually: npm install -g vercel"
        exit 1
    fi
fi

# Function to deploy a project
deploy_project() {
    local project_name=$1
    local project_dir=$2
    
    echo -e "\n${BLUE}📦 Deploying $project_name...${NC}"
    cd "$project_dir" || exit 1
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ package.json not found in $project_dir${NC}"
        return 1
    fi
    
    # Deploy to Vercel
    vercel --prod
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $project_name deployed successfully!${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to deploy $project_name${NC}"
        return 1
    fi
}

# Main deployment process
main() {
    echo -e "${BLUE}Starting deployment process...${NC}\n"
    
    # Get current directory
    ROOT_DIR=$(pwd)
    
    # Deploy Backend
    echo -e "${YELLOW}Step 1: Deploy Backend API${NC}"
    deploy_project "Backend API" "$ROOT_DIR/backend"
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Backend deployment failed. Aborting.${NC}"
        exit 1
    fi
    
    # Get backend URL
    echo -e "\n${YELLOW}📝 Please note your backend URL (e.g., https://your-backend.vercel.app)${NC}"
    read -p "Enter your backend URL: " BACKEND_URL
    
    # Update frontend environment
    echo -e "\n${BLUE}Updating frontend environment...${NC}"
    cd "$ROOT_DIR/frontend"
    
    # Create .env.production with backend URL
    cat > .env.production << EOF
# Production environment variables
NEXT_PUBLIC_API_URL=$BACKEND_URL
NEXT_PUBLIC_WS_URL=${BACKEND_URL/https/wss}
NEXT_PUBLIC_ENVIRONMENT=production
EOF
    
    echo -e "${GREEN}✅ Frontend environment updated${NC}"
    
    # Deploy Frontend
    echo -e "\n${YELLOW}Step 2: Deploy Frontend Dashboard${NC}"
    deploy_project "Frontend Dashboard" "$ROOT_DIR/frontend"
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Frontend deployment failed.${NC}"
        exit 1
    fi
    
    # Success message
    echo -e "\n${GREEN}🎉 Deployment Complete!${NC}"
    echo -e "${GREEN}=======================+${NC}"
    echo -e "${BLUE}Your applications are now live on Vercel!${NC}"
    echo -e "\n${YELLOW}Next Steps:${NC}"
    echo "1. Set environment variables in Vercel Dashboard"
    echo "2. Configure custom domains if needed"
    echo "3. Monitor your applications in Vercel Dashboard"
    echo -e "\n${BLUE}Dashboard: https://vercel.com/dashboard${NC}"
}

# Run main function
main

# Return to root directory
cd "$ROOT_DIR"