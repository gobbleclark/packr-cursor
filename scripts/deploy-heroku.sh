#!/bin/bash

# Heroku Deployment Script for Packr
# This script helps deploy the Packr application to Heroku

set -e

echo "🚀 Deploying Packr to Heroku..."

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI is not installed. Please install it first:"
    echo "   https://devcenter.heroku.com/articles/heroku-cli"
    exit 1
fi

# Check if user is logged in to Heroku
if ! heroku auth:whoami &> /dev/null; then
    echo "❌ Please log in to Heroku first:"
    echo "   heroku login"
    exit 1
fi

# Get app name from user or use default
read -p "Enter your Heroku app name (or press Enter for 'packr-app'): " APP_NAME
APP_NAME=${APP_NAME:-packr-app}

echo "📱 Using app name: $APP_NAME"

# Check if app exists, create if not
if ! heroku apps:info $APP_NAME &> /dev/null; then
    echo "🆕 Creating new Heroku app: $APP_NAME"
    heroku create $APP_NAME
else
    echo "✅ App $APP_NAME already exists"
fi

# Add buildpack
echo "🔧 Setting up Node.js buildpack..."
heroku buildpacks:set heroku/nodejs -a $APP_NAME

# Add Postgres addon
echo "🗄️ Adding PostgreSQL addon..."
heroku addons:create heroku-postgresql:essential-0 -a $APP_NAME || echo "PostgreSQL addon may already exist"

# Add Redis addon
echo "📦 Adding Redis addon..."
heroku addons:create heroku-redis:mini -a $APP_NAME || echo "Redis addon may already exist"

# Set environment variables
echo "⚙️ Setting environment variables..."
echo "Please set the following environment variables in your Heroku dashboard:"
echo "- CLERK_PUBLISHABLE_KEY"
echo "- CLERK_SECRET_KEY"
echo "- NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
echo "- WEBHOOK_TRACKSTAR_SECRET"
echo "- S3_BUCKET"
echo "- S3_REGION"
echo "- S3_ACCESS_KEY_ID"
echo "- S3_SECRET_ACCESS_KEY"
echo ""
echo "Optional variables:"
echo "- SENTRY_DSN"
echo "- POSTHOG_KEY"
echo "- NEXT_PUBLIC_POSTHOG_KEY"

# Set basic environment variables
heroku config:set NODE_ENV=production -a $APP_NAME
heroku config:set LOG_LEVEL=info -a $APP_NAME

# Deploy the application
echo "🚀 Deploying to Heroku..."
git add .
git commit -m "Deploy to Heroku" || echo "No changes to commit"
heroku git:remote -a $APP_NAME
git push heroku main

# Run database migrations
echo "🗄️ Running database migrations..."
heroku run npm run db:migrate:production -a $APP_NAME

# Open the app
echo "✅ Deployment complete!"
echo "🌐 Opening your app..."
heroku open -a $APP_NAME

echo ""
echo "📋 Next steps:"
echo "1. Set your environment variables in the Heroku dashboard"
echo "2. Configure your domain (if needed)"
echo "3. Set up monitoring and logging"
echo ""
echo "🔗 Useful commands:"
echo "  heroku logs --tail -a $APP_NAME    # View logs"
echo "  heroku config -a $APP_NAME         # View config vars"
echo "  heroku ps -a $APP_NAME             # View running processes"
