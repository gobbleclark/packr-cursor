# Replit Setup Guide

## The Problem
Your Replit is showing "Route / not found" because:
1. The client application hasn't been built
2. The server is looking for static files in the wrong location
3. The build output directory path was incorrect

## What I Fixed
1. **Updated `server/vite.ts`** - Changed static file serving to look in `client/dist` instead of `public`
2. **Updated `vite.config.ts`** - Changed build output to `client/dist` instead of `dist/public`
3. **Added better error handling** - Shows helpful message if build is missing

## Steps to Deploy on Replit

### 1. Build the Client
```bash
npm run build
```

### 2. Start the Server
```bash
npm run start
```

### 3. Alternative: Use the Run Button
- Click the "Run" button in Replit
- It will automatically run `npm run build` then `npm run start`

## What Happens Now
- The build process creates a `client/dist` directory with your React app
- The server serves static files from `client/dist`
- All routes fall back to `index.html` for client-side routing
- Your React app will handle the routing properly

## If You Still Get Errors
1. Make sure `npm run build` completed successfully
2. Check that `client/dist` directory exists and contains `index.html`
3. Verify the server is running on port 5000
4. Check Replit logs for any build errors

## Development vs Production
- **Development**: Uses Vite dev server with hot reload
- **Production**: Serves built static files from `client/dist`
- **Replit**: Automatically uses production mode

