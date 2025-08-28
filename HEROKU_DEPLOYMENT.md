# Heroku Deployment Guide for Packr

This guide will help you deploy the Packr application to Heroku. Packr is a monorepo containing both an API server and a Next.js web application.

## Prerequisites

1. **Heroku CLI**: Install from [https://devcenter.heroku.com/articles/heroku-cli](https://devcenter.heroku.com/articles/heroku-cli)
2. **Git**: Ensure your project is in a Git repository
3. **Heroku Account**: Sign up at [https://heroku.com](https://heroku.com)

## Quick Deployment (Automated)

The easiest way to deploy is using our automated script:

```bash
./scripts/deploy-heroku.sh
```

This script will:
- Create a new Heroku app (or use existing)
- Set up required addons (PostgreSQL, Redis)
- Configure buildpacks
- Deploy your application
- Run database migrations

## Manual Deployment Steps

If you prefer to deploy manually, follow these steps:

### 1. Install Heroku CLI and Login

```bash
# Install Heroku CLI (macOS)
brew tap heroku/brew && brew install heroku

# Login to Heroku
heroku login
```

### 2. Create Heroku Application

```bash
# Create a new app (replace 'your-app-name' with your desired name)
heroku create your-app-name

# Or use an existing app
heroku git:remote -a your-existing-app-name
```

### 3. Add Required Addons

```bash
# Add PostgreSQL database
heroku addons:create heroku-postgresql:essential-0

# Add Redis for caching and queues
heroku addons:create heroku-redis:mini
```

### 4. Configure Environment Variables

Set the following required environment variables in your Heroku dashboard or via CLI:

```bash
# Required Authentication Variables
heroku config:set CLERK_PUBLISHABLE_KEY="pk_live_your_key"
heroku config:set CLERK_SECRET_KEY="sk_live_your_key"
heroku config:set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_your_key"

# Required API Configuration
heroku config:set WEBHOOK_TRACKSTAR_SECRET="your_trackstar_webhook_secret"

# Required S3/Storage Configuration
heroku config:set S3_BUCKET="your-s3-bucket-name"
heroku config:set S3_REGION="us-east-1"
heroku config:set S3_ACCESS_KEY_ID="your_access_key"
heroku config:set S3_SECRET_ACCESS_KEY="your_secret_key"

# Basic Configuration (automatically set)
heroku config:set NODE_ENV="production"
heroku config:set LOG_LEVEL="info"
```

#### Optional Environment Variables

```bash
# Error Tracking (Sentry)
heroku config:set SENTRY_DSN="https://your-sentry-dsn.ingest.sentry.io/123"

# Analytics (PostHog)
heroku config:set POSTHOG_KEY="your_posthog_key"
heroku config:set NEXT_PUBLIC_POSTHOG_KEY="your_posthog_key"
```

### 5. Deploy Application

```bash
# Add and commit your changes
git add .
git commit -m "Deploy to Heroku"

# Deploy to Heroku
git push heroku main
```

### 6. Run Database Migrations

```bash
# Run Prisma migrations in production
heroku run npm run db:migrate:production

# Optional: Seed the database
heroku run npm run db:seed:production
```

### 7. Open Your Application

```bash
heroku open
```

## Architecture Overview

The Heroku deployment uses the following architecture:

```
┌─────────────────┐
│   Heroku Web    │
│   Process       │
├─────────────────┤
│   server.js     │ ← Main entry point
├─────────────────┤
│ ┌─────────────┐ │
│ │ Next.js App │ │ ← Frontend (Port: $PORT)
│ │ (apps/web)  │ │
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │ API Server  │ │ ← Backend (Port: 4000)
│ │ (apps/api)  │ │
│ └─────────────┘ │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ Heroku Postgres │ ← Database
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Heroku Redis   │ ← Cache & Queues
└─────────────────┘
```

## Configuration Files

The deployment includes these configuration files:

- **`Procfile`**: Defines how Heroku runs your application
- **`app.json`**: Heroku app configuration and addon requirements
- **`server.js`**: Production server that runs both API and web apps
- **`package.json`**: Updated with production scripts and dependencies

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection (auto-set by Heroku) |
| `REDIS_URL` | ✅ | Redis connection (auto-set by Heroku) |
| `CLERK_PUBLISHABLE_KEY` | ✅ | Clerk authentication public key |
| `CLERK_SECRET_KEY` | ✅ | Clerk authentication secret key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk public key for frontend |
| `WEBHOOK_TRACKSTAR_SECRET` | ✅ | Trackstar webhook verification secret |
| `S3_BUCKET` | ✅ | S3 bucket name for file storage |
| `S3_REGION` | ✅ | S3 region |
| `S3_ACCESS_KEY_ID` | ✅ | S3 access key |
| `S3_SECRET_ACCESS_KEY` | ✅ | S3 secret key |
| `SENTRY_DSN` | ❌ | Error tracking (optional) |
| `POSTHOG_KEY` | ❌ | Analytics (optional) |
| `NEXT_PUBLIC_POSTHOG_KEY` | ❌ | Frontend analytics (optional) |

## Useful Heroku Commands

```bash
# View application logs
heroku logs --tail

# View configuration variables
heroku config

# View running processes
heroku ps

# Scale web processes
heroku ps:scale web=1

# Run database migrations
heroku run npm run db:migrate:production

# Access database console
heroku pg:psql

# Access Redis console
heroku redis:cli

# Restart application
heroku restart

# View addon information
heroku addons
```

## Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Check build logs
   heroku logs --tail
   
   # Ensure all dependencies are in package.json
   npm install
   git add package-lock.json
   git commit -m "Update dependencies"
   git push heroku main
   ```

2. **Database Connection Issues**
   ```bash
   # Verify DATABASE_URL is set
   heroku config:get DATABASE_URL
   
   # Run migrations
   heroku run npm run db:migrate:production
   ```

3. **Environment Variable Issues**
   ```bash
   # List all config vars
   heroku config
   
   # Set missing variables
   heroku config:set VARIABLE_NAME="value"
   ```

4. **Port Binding Issues**
   - Heroku automatically sets the `PORT` environment variable
   - The application uses this port via `process.env.PORT`
   - Never hardcode port numbers in production

### Performance Optimization

1. **Enable Gzip Compression** (already configured in API)
2. **Use CDN for Static Assets** (configure S3/CloudFront)
3. **Enable Redis Caching** (already configured)
4. **Monitor with Heroku Metrics** or external tools

### Scaling

```bash
# Scale web processes
heroku ps:scale web=2

# Upgrade database
heroku addons:upgrade heroku-postgresql:standard-0

# Upgrade Redis
heroku addons:upgrade heroku-redis:premium-0
```

## Security Considerations

1. **Environment Variables**: Never commit secrets to Git
2. **HTTPS**: Heroku provides SSL certificates automatically
3. **Database**: Use connection pooling for production
4. **CORS**: Configure appropriate CORS settings
5. **Rate Limiting**: Already configured in the API

## Monitoring and Logging

1. **Heroku Logs**: `heroku logs --tail`
2. **Sentry**: For error tracking (optional)
3. **PostHog**: For user analytics (optional)
4. **Heroku Metrics**: Built-in performance monitoring

## Cost Estimation

Basic Heroku setup costs (as of 2024):

- **Web Dyno**: $7/month (Basic)
- **PostgreSQL**: $9/month (Essential-0)
- **Redis**: $15/month (Mini)
- **Total**: ~$31/month

For production, consider:
- **Standard Dynos**: $25/month (better performance)
- **Standard PostgreSQL**: $50/month (better performance, backups)
- **Premium Redis**: $60/month (high availability)

## Next Steps After Deployment

1. **Configure Custom Domain** (if needed)
2. **Set up CI/CD Pipeline** with GitHub Actions
3. **Configure Monitoring and Alerts**
4. **Set up Backup Strategy**
5. **Performance Testing and Optimization**

## Support

If you encounter issues:

1. Check the [Heroku Dev Center](https://devcenter.heroku.com/)
2. Review application logs: `heroku logs --tail`
3. Check the GitHub repository for issues
4. Contact the development team

---

**Happy Deploying! 🚀**
