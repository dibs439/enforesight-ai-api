#!/bin/bash

# Load NVM if available
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh"
fi

# Use the Node version specified in .nvmrc
if [ -f ".nvmrc" ]; then
    nvm use
else
    nvm use 20.13.0
fi

# Set the PATH to ensure we're using the correct Node version
export PATH="$HOME/.nvm/versions/node/v20.13.0/bin:$PATH"

# Check Node version
echo "Using Node version: $(node --version)"
echo "Using npm version: $(npm --version)"

# Run the dev server with tsx (better ESM support)
exec nodemon --exec "tsx ./src/index.ts"