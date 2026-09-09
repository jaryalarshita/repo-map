#!/bin/bash
# =============================================================================
# setup-vm.sh — Fresh Ubuntu 22.04 VM Setup Script
# =============================================================================
# USAGE:  scp this file to your VM, then run:
#         chmod +x setup-vm.sh && ./setup-vm.sh
#
# This sets up everything needed to run the Codebase Map backend:
#   - Node.js 20 LTS
#   - g++ / build-essential for C++ compilation
#   - PM2 process manager to keep the server alive
# =============================================================================

set -e  # Exit on any error

echo ""
echo "=========================================="
echo "  Codebase Map — VM Setup"
echo "=========================================="
echo ""

# -------------------------------------------------------------------------
# Step 1: Update system packages
# -------------------------------------------------------------------------
# Always update first — Ubuntu's default packages can be months old.
echo "📦 Step 1: Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y

# -------------------------------------------------------------------------
# Step 2: Install Node.js 20 LTS via NodeSource
# -------------------------------------------------------------------------
# Ubuntu's default apt Node.js is v12 (ancient). NodeSource provides v20 LTS.
echo ""
echo "📦 Step 2: Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# -------------------------------------------------------------------------
# Step 3: Install g++ for C++ compilation
# -------------------------------------------------------------------------
# build-essential is a meta-package: includes gcc, g++, make, and more.
echo ""
echo "📦 Step 3: Installing g++ and build tools..."
sudo apt-get install -y g++ build-essential

# -------------------------------------------------------------------------
# Step 4: Verify installations
# -------------------------------------------------------------------------
echo ""
echo "🔍 Step 4: Verifying installations..."
echo "   Node.js: $(node --version)"
echo "   npm:     $(npm --version)"
echo "   g++:     $(g++ --version | head -1)"

# -------------------------------------------------------------------------
# Step 5: Download nlohmann/json header (not in git)
# -------------------------------------------------------------------------
echo ""
echo "📦 Step 5: Downloading nlohmann/json.hpp..."
cd /home/ubuntu/codebase-map/backend/parser
curl -sL -o json.hpp https://github.com/nlohmann/json/releases/latest/download/json.hpp
echo "   Downloaded json.hpp ($(wc -c < json.hpp) bytes)"

# -------------------------------------------------------------------------
# Step 6: Install Node.js dependencies
# -------------------------------------------------------------------------
echo ""
echo "📦 Step 6: Installing Node.js dependencies..."
cd /home/ubuntu/codebase-map/backend
npm install

# -------------------------------------------------------------------------
# Step 7: Compile the C++ parser directly on the server
# -------------------------------------------------------------------------
# We compile natively instead of using Docker to avoid architecture mismatches.
echo ""
echo "🔨 Step 7: Compiling C++ parser..."
cd parser
make clean && make
cd ..
echo "   ✅ Parser compiled successfully"

# -------------------------------------------------------------------------
# Step 8: Set up environment variables
# -------------------------------------------------------------------------
echo ""
echo "🔑 Step 8: Setting up .env..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo ""
    echo "   ⚠️  IMPORTANT: Edit .env and add your DEEPMIND_API_KEY"
    echo "   Run: nano .env"
else
    echo "   .env already exists — skipping"
fi

# -------------------------------------------------------------------------
# Step 9: Install PM2 process manager
# -------------------------------------------------------------------------
# PM2 keeps Node.js running after SSH disconnect, auto-restarts on crash,
# and provides log management.
echo ""
echo "📦 Step 9: Installing PM2..."
sudo npm install -g pm2

# -------------------------------------------------------------------------
# Step 10: Start the server with PM2
# -------------------------------------------------------------------------
echo ""
echo "🚀 Step 10: Starting server with PM2..."
pm2 start server.js --name "codebase-map-backend"
pm2 save
pm2 startup | tail -1 | bash  # Auto-restart on VM reboot

# -------------------------------------------------------------------------
# Step 11: Open firewall port
# -------------------------------------------------------------------------
echo ""
echo "🔓 Step 11: Opening port 3001..."
sudo ufw allow 3001
sudo ufw allow ssh   # Make sure SSH stays open!
# Only enable ufw if it's not already active
sudo ufw --force enable

echo ""
echo "=========================================="
echo "  ✅ Setup Complete!"
echo "=========================================="
echo ""
echo "  Server running at:  http://$(curl -s ifconfig.me):3001"
echo "  Health check:       curl http://localhost:3001/api/analyze/ping"
echo "  View logs:          pm2 logs codebase-map-backend"
echo "  Restart:            pm2 restart codebase-map-backend"
echo ""
echo "  ⚠️  Don't forget to edit .env with your DEEPMIND_API_KEY!"
echo ""
