const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const next = require('next');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT || 3000;

// Start the API server
const { spawn } = require('child_process');

async function startServer() {
  console.log('Starting Packr production server...');
  
  // Check for API build files
  const fs = require('fs');
  let apiEntryPoint = null;
  
  // Try different possible locations for the API entry point
  const possiblePaths = [
    { path: './apps/api/dist/index.js', command: 'node' },
    { path: './apps/api/dist/src/index.js', command: 'node' },
    { path: './apps/api/dist/apps/api/src/index.js', command: 'node' },
    { path: './apps/api/src/index.ts', command: 'npx tsx' }  // Use tsx for TypeScript files
  ];
  
  let apiConfig = null;
  for (const config of possiblePaths) {
    if (fs.existsSync(config.path)) {
      apiConfig = config;
      break;
    }
  }
  
  if (!apiConfig) {
    console.error('❌ API entry point not found! Checked paths:', possiblePaths.map(p => p.path));
    console.log('Available files in apps/api/dist:', fs.existsSync('./apps/api/dist') ? fs.readdirSync('./apps/api/dist') : 'Directory does not exist');
    process.exit(1);
  }
  
  // Start the API server in the background
  console.log('Starting API server from:', apiConfig.path, 'using', apiConfig.command);
  const commandArgs = apiConfig.command === 'npx tsx' ? ['npx', 'tsx', apiConfig.path] : [apiConfig.command, apiConfig.path];
  const apiProcess = spawn(commandArgs[0], commandArgs.slice(1), {
    env: { ...process.env, PORT: '4000' },
    stdio: 'inherit'
  });

  // Wait a moment for API to start
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Create Next.js app
  const app = next({ 
    dev: false, 
    dir: './apps/web',
    conf: {
      distDir: '.next'
    }
  });
  
  const handle = app.getRequestHandler();
  
  await app.prepare();
  
  // Create Express server
  const server = express();
  
  // Proxy API requests to the API server
  server.use('/api', createProxyMiddleware({
    target: 'http://localhost:4000',
    changeOrigin: true,
    pathRewrite: {
      '^/api': '/api'
    }
  }));
  
  // Handle all other requests with Next.js
  server.all('*', (req, res) => {
    return handle(req, res);
  });
  
  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    apiProcess.kill('SIGTERM');
    process.exit(0);
  });
}

startServer().catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});
