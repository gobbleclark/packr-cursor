/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@packr/database'],
  webpack: (config) => {
    // Exclude vitest config from Next.js build
    config.module.rules.push({
      test: /vitest\.config\.(ts|js)$/,
      loader: 'ignore-loader'
    });
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
