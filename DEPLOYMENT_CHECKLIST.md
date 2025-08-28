# Heroku Deployment Checklist

Use this checklist to ensure a successful deployment to Heroku.

## Pre-Deployment

- [ ] **Heroku CLI installed** and logged in (`heroku login`)
- [ ] **Git repository** is up to date with latest changes
- [ ] **Environment variables** are documented and ready
- [ ] **Database migrations** are tested locally
- [ ] **Build process** works locally (`npm run build`)

## Required Environment Variables

- [ ] `CLERK_PUBLISHABLE_KEY` - Clerk authentication public key
- [ ] `CLERK_SECRET_KEY` - Clerk authentication secret key  
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key for frontend
- [ ] `WEBHOOK_TRACKSTAR_SECRET` - Trackstar webhook verification secret
- [ ] `S3_BUCKET` - S3 bucket name for file storage
- [ ] `S3_REGION` - S3 region (e.g., us-east-1)
- [ ] `S3_ACCESS_KEY_ID` - S3 access key
- [ ] `S3_SECRET_ACCESS_KEY` - S3 secret key

## Optional Environment Variables

- [ ] `SENTRY_DSN` - Error tracking (recommended for production)
- [ ] `POSTHOG_KEY` - Analytics key
- [ ] `NEXT_PUBLIC_POSTHOG_KEY` - Frontend analytics key

## Deployment Steps

- [ ] **Create Heroku app** (`heroku create your-app-name`)
- [ ] **Add PostgreSQL addon** (`heroku addons:create heroku-postgresql:essential-0`)
- [ ] **Add Redis addon** (`heroku addons:create heroku-redis:mini`)
- [ ] **Set environment variables** (use `heroku config:set` or dashboard)
- [ ] **Deploy application** (`git push heroku main`)
- [ ] **Run database migrations** (`heroku run npm run db:migrate:production`)
- [ ] **Verify deployment** (`heroku open`)

## Post-Deployment Verification

- [ ] **Application loads** without errors
- [ ] **Database connection** is working
- [ ] **Authentication** (Clerk) is working
- [ ] **File uploads** (S3) are working
- [ ] **API endpoints** are responding
- [ ] **Trackstar integration** is working
- [ ] **Webhooks** are receiving data

## Monitoring Setup

- [ ] **View logs** (`heroku logs --tail`)
- [ ] **Set up error tracking** (Sentry)
- [ ] **Configure alerts** for critical issues
- [ ] **Monitor performance** metrics

## Security Checklist

- [ ] **Environment variables** are not committed to Git
- [ ] **HTTPS** is enabled (automatic with Heroku)
- [ ] **CORS** is properly configured
- [ ] **Rate limiting** is enabled
- [ ] **Database** access is restricted

## Performance Optimization

- [ ] **Gzip compression** is enabled
- [ ] **Redis caching** is configured
- [ ] **CDN** is set up for static assets (optional)
- [ ] **Database queries** are optimized

## Backup and Recovery

- [ ] **Database backups** are configured
- [ ] **Environment variables** are documented
- [ ] **Deployment process** is documented
- [ ] **Rollback plan** is prepared

## Quick Commands Reference

```bash
# View logs
heroku logs --tail -a your-app-name

# View config
heroku config -a your-app-name

# Run migrations
heroku run npm run db:migrate:production -a your-app-name

# Restart app
heroku restart -a your-app-name

# Scale dynos
heroku ps:scale web=1 -a your-app-name
```

## Troubleshooting

If deployment fails, check:

1. **Build logs**: `heroku logs --tail`
2. **Environment variables**: `heroku config`
3. **Addon status**: `heroku addons`
4. **Process status**: `heroku ps`

Common issues:
- Missing environment variables
- Database connection problems
- Build failures due to missing dependencies
- Port binding issues (use `process.env.PORT`)

---

**✅ Deployment Complete!**

Your Packr application should now be running on Heroku. Don't forget to:
- Set up monitoring and alerts
- Configure your custom domain (if needed)
- Test all functionality thoroughly
- Document any production-specific configurations
