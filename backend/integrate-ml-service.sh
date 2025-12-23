#!/bin/bash

# 🐍 Python ML Service Integration Script
# Copies Python ML service and integration files to backend repository

set -e  # Exit on error

FRONTEND_DIR="/Users/usmanqazi/creatorhub-frontend"
BACKEND_DIR="/Users/usmanqazi/creatorhub-backend"

echo "🐍 Python ML Service Integration"
echo "================================="
echo ""

# Check if directories exist
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "❌ Frontend directory not found: $FRONTEND_DIR"
    exit 1
fi

if [ ! -d "$BACKEND_DIR" ]; then
    echo "❌ Backend directory not found: $BACKEND_DIR"
    exit 1
fi

# 1. Copy Python ML Service
echo "📦 Step 1: Copying Python ML Service..."
if [ -d "$FRONTEND_DIR/python_ml_service" ]; then
    cp -r "$FRONTEND_DIR/python_ml_service" "$BACKEND_DIR/"
    echo "✅ Python ML service copied to backend"
else
    echo "❌ Python ML service not found in frontend"
    exit 1
fi

# 2. Copy TypeScript client
echo "📦 Step 2: Copying TypeScript client..."
if [ -f "$FRONTEND_DIR/server/services/pythonMLService.ts" ]; then
    mkdir -p "$BACKEND_DIR/server/services"
    cp "$FRONTEND_DIR/server/services/pythonMLService.ts" "$BACKEND_DIR/server/services/"
    echo "✅ TypeScript client copied"
else
    echo "❌ TypeScript client not found"
    exit 1
fi

# 3. Copy Express routes
echo "📦 Step 3: Copying Express routes..."
if [ -f "$FRONTEND_DIR/server/routes/ml-service-routes.ts" ]; then
    mkdir -p "$BACKEND_DIR/server/routes"
    cp "$FRONTEND_DIR/server/routes/ml-service-routes.ts" "$BACKEND_DIR/server/routes/"
    echo "✅ Express routes copied"
else
    echo "❌ Express routes not found"
    exit 1
fi

# 4. Update .env
echo "📦 Step 4: Updating .env..."
if [ -f "$BACKEND_DIR/.env" ]; then
    if ! grep -q "PYTHON_ML_SERVICE_URL" "$BACKEND_DIR/.env"; then
        echo "" >> "$BACKEND_DIR/.env"
        echo "# -----------------------------------------------------------------------------" >> "$BACKEND_DIR/.env"
        echo "# PYTHON ML SERVICE" >> "$BACKEND_DIR/.env"
        echo "# -----------------------------------------------------------------------------" >> "$BACKEND_DIR/.env"
        echo "PYTHON_ML_SERVICE_URL=http://localhost:8000" >> "$BACKEND_DIR/.env"
        echo "✅ .env updated"
    else
        echo "⚠️  PYTHON_ML_SERVICE_URL already exists in .env"
    fi
else
    echo "❌ .env not found in backend"
    exit 1
fi

echo ""
echo "✅ Integration files copied successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Add ML service routes to $BACKEND_DIR/server/index.ts"
echo "2. Start Python ML service: cd $BACKEND_DIR/python_ml_service && source venv/bin/activate && uvicorn main:app --reload"
echo "3. Start Node.js backend: cd $BACKEND_DIR && npm run dev"
echo "4. Test integration: curl http://localhost:5050/api/ml/health"
echo ""
echo "📖 See PYTHON_ML_SERVICE_INTEGRATION_STATUS.md for detailed instructions"

