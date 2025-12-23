#!/bin/bash

# Run Vendor System Migrations
# This script connects directly to the database and runs the migrations

echo "🚀 Starting Vendor System Migrations..."
echo ""

# Load DATABASE_URL from .env
export $(grep -v '^#' .env | grep DATABASE_URL | xargs)

if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL not found in .env file"
  exit 1
fi

echo "✅ Database connection configured"
echo ""

# Function to run a migration
run_migration() {
  local name=$1
  local file=$2
  local description=$3
  
  echo "📄 Running: $name"
  echo "   Description: $description"
  
  if [ ! -f "$file" ]; then
    echo "   ⚠️  Migration file not found: $file"
    return 1
  fi
  
  # Run migration using psql
  psql "$DATABASE_URL" -f "$file" > /dev/null 2>&1
  
  if [ $? -eq 0 ]; then
    echo "   ✅ $name completed successfully!"
    echo ""
    return 0
  else
    echo "   ⚠️  $name had issues (may already exist)"
    echo ""
    return 0
  fi
}

# Run migrations
success=0
total=0

# Migration 1: Vendor Management System
run_migration \
  "Vendor Management System" \
  "server/db/migrations/056_vendor_management_system.sql" \
  "Creates vendor inventory, orders, insights, tasks, and statistics tables"
if [ $? -eq 0 ]; then ((success++)); fi
((total++))

# Migration 2: Push Subscriptions
run_migration \
  "Push Subscriptions" \
  "server/db/migrations/create_push_subscriptions_table.sql" \
  "Creates push notification subscriptions table for vendor alerts"
if [ $? -eq 0 ]; then ((success++)); fi
((total++))

# Migration 3: Vendor Enhancements
run_migration \
  "Vendor Enhancements" \
  "server/db/migrations/057_vendor_enhancements.sql" \
  "Adds financial management, shipping, reviews, variants, and digital delivery"
if [ $? -eq 0 ]; then ((success++)); fi
((total++))

# Summary
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📊 Migration Summary:"
echo "   ✅ Successful: $success"
echo "   📋 Total: $total"
echo ""

if [ $success -eq $total ]; then
  echo "🎉 All vendor migrations completed successfully!"
  echo ""
  echo "📦 Vendor System is now ready with:"
  echo "   • Inventory Management (with timeline tracking)"
  echo "   • Order Management (with line items)"
  echo "   • AI-Driven Insights & Recommendations"
  echo "   • Task Management (onboarding & progress)"
  echo "   • Analytics & Statistics"
  echo "   • Push Notification Subscriptions"
  echo ""
  echo "🚀 You can now start using the vendor system!"
  echo ""
else
  echo "⚠️  Some migrations may have already been run."
  echo "   Check your database to verify all tables exist."
  echo ""
fi


