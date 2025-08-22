#!/bin/bash

echo "🚀 Setting up Packr CS development environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Start PostgreSQL and Redis
echo "📦 Starting PostgreSQL and Redis..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are healthy
if ! docker-compose ps | grep -q "healthy"; then
    echo "❌ Services are not healthy. Please check Docker Compose logs."
    exit 1
fi

echo "✅ Services are running!"

# Copy development environment
if [ ! -f .env ]; then
    echo "📝 Creating .env file from development template..."
    cp env.development .env
    echo "✅ .env file created. Please review and update as needed."
else
    echo "ℹ️  .env file already exists."
fi

# Install dependencies if not already installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "ℹ️  Dependencies already installed."
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
cd packages/database
npx prisma generate
cd ../..

# Push database schema
echo "🗄️  Setting up database schema..."
cd packages/database
npx prisma db push
cd ../..

echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Review and update .env file with your configuration"
echo "2. Start the development servers: npm run dev"
echo "3. Open http://localhost:3000 for the web app"
echo "4. Open http://localhost:4000/health for the API health check"
echo ""
echo "Services:"
echo "- PostgreSQL: localhost:5432"
echo "- Redis: localhost:6379"
echo "- Web App: http://localhost:3000"
echo "- API Server: http://localhost:4000"
