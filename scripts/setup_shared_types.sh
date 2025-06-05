#!/bin/bash

# This script installs the shared types package in the frontend
# and sets up development links for both frontend and backend

# Colors for better output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Setting up shared types package...${NC}"

# Navigate to project root
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

# Step 1: Install shared package in frontend
echo -e "${YELLOW}Installing shared types in frontend...${NC}"
cd "$PROJECT_ROOT/frontend"
npm install "../shared" --no-save

# Step 2: Install shared package in backend virtual environment if it exists
echo -e "${YELLOW}Checking for backend virtual environment...${NC}"
if [ -d "$PROJECT_ROOT/backend/clauseiq_env" ]; then
    echo -e "${YELLOW}Installing shared types in backend virtual environment...${NC}"
    cd "$PROJECT_ROOT/backend"
    source clauseiq_env/bin/activate
    pip install -e "../shared"
    deactivate
else
    echo -e "${YELLOW}No virtual environment found. Skipping backend installation.${NC}"
    echo -e "${YELLOW}Run 'pip install -e ../shared' in your backend environment manually.${NC}"
fi

echo -e "${GREEN}Setup complete!${NC}"
echo -e "${YELLOW}Remember to run 'npm install' in the frontend if you haven't already.${NC}"
