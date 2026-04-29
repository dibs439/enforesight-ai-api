#!/bin/bash

# Script to initialize the default admin user in Convex

echo "🔧 Initializing default admin user with secure password hashing..."

# Run the secure action to create default admin with hashed password
npx convex run users:initializeDefaultAdminSecure

echo "✅ Default admin user initialized with secure password!"
echo ""
echo "📝 Default credentials:"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "⚠️  IMPORTANT: Change the default password in production!"
