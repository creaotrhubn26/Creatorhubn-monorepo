#!/bin/bash
# Update Vercel Environment Variables
# Adds VAPID public key to Vercel project
#
# Usage: ./scripts/update-vercel-env-vars.sh
# Prerequisites: Vercel CLI must be installed and authenticated

set -e

VAPID_PUBLIC_KEY="BN_3cOcqCG21vOe5QCvuMeJtdtS43Fc4ZnHbs8GXjY_FOjqWVuPy4gBBqht1cBoTuCenp22ETqDZN8hOY01DnzE"

echo "🚀 Updating Vercel environment variables..."
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI is not installed"
    echo "Install it with: npm install -g vercel"
    exit 1
fi

# Check if logged in
if ! vercel whoami &> /dev/null; then
    echo "⚠️  Not logged in to Vercel. Please run: vercel login"
    exit 1
fi

echo "📝 Setting VITE_VAPID_PUBLIC_KEY..."

# Add environment variable for all environments
vercel env add VITE_VAPID_PUBLIC_KEY production <<< "$VAPID_PUBLIC_KEY" || {
    echo "⚠️  Variable might already exist for production, updating..."
    vercel env rm VITE_VAPID_PUBLIC_KEY production --yes 2>/dev/null || true
    vercel env add VITE_VAPID_PUBLIC_KEY production <<< "$VAPID_PUBLIC_KEY"
}

vercel env add VITE_VAPID_PUBLIC_KEY preview <<< "$VAPID_PUBLIC_KEY" || {
    echo "⚠️  Variable might already exist for preview, updating..."
    vercel env rm VITE_VAPID_PUBLIC_KEY preview --yes 2>/dev/null || true
    vercel env add VITE_VAPID_PUBLIC_KEY preview <<< "$VAPID_PUBLIC_KEY"
}

vercel env add VITE_VAPID_PUBLIC_KEY development <<< "$VAPID_PUBLIC_KEY" || {
    echo "⚠️  Variable might already exist for development, updating..."
    vercel env rm VITE_VAPID_PUBLIC_KEY development --yes 2>/dev/null || true
    vercel env add VITE_VAPID_PUBLIC_KEY development <<< "$VAPID_PUBLIC_KEY"
}

echo ""
echo "✅ VITE_VAPID_PUBLIC_KEY set for all environments!"
echo "🔄 Please redeploy your Vercel project for changes to take effect."
echo ""
echo "To redeploy:"
echo "  vercel --prod"
echo "  or push a new commit to trigger auto-deploy"
























