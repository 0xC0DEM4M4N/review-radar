#!/bin/bash
set -e

# ReviewRadar — Cloudflare Pages Deploy Script
# Usage: ./deploy.sh [project-name] [branch]

PROJECT_NAME="${1:-reviewradar}"
BRANCH="${2:-main}"
BUILD_DIR="dist"

echo "🚀 ReviewRadar Deploy"
echo "====================="
echo ""

# Check for wrangler
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Install with:"
    echo "   npm install -g wrangler"
    exit 1
fi

# Check login status
echo "🔑 Checking Cloudflare login..."
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not logged in. Run: wrangler login"
    exit 1
fi
echo "✅ Logged in"
echo ""

# Build
echo "🔨 Building..."
npm run build
echo "✅ Build complete"
echo ""

# Deploy
echo "📤 Deploying to Cloudflare Pages..."
echo "   Project: $PROJECT_NAME"
echo "   Branch:  $BRANCH"
echo "   Source:  $BUILD_DIR"
echo ""

wrangler pages deploy "$BUILD_DIR" --project-name="$PROJECT_NAME" --branch="$BRANCH"

echo ""
echo "✅ Deploy complete!"
echo ""
