#!/bin/bash

# Termux Alist Guide - Auto Setup Script

echo -e "\033[1;32mStarting Termux Alist Guide setup...\033[0m"

# 1. Update Termux repositories
echo "Updating package lists..."
pkg update -y

# 2. Install Node.js LTS if not present
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    pkg install nodejs-lts -y
else
    echo "Node.js is already installed."
fi

# 3. Install dependencies
if [ -f "package.json" ]; then
    echo "Installing project dependencies (this may take a moment)..."
    npm install
else
    echo -e "\033[1;31mError: package.json not found. Make sure you are in the correct directory.\033[0m"
    exit 1
fi

# 4. Start the application
echo -e "\033[1;32mSetup complete! Starting the app...\033[0m"
echo "The app will be available at http://localhost:5173"
npm run dev -- --host