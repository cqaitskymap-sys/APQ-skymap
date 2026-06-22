const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  experimental: {
    // lucide-react barrel optimization breaks RSC client manifest on heavy dashboard routes
    optimizePackageImports: [],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
      config.resolve.alias = {
        ...config.resolve.alias,
        '@firebase/firestore': path.join(
          __dirname,
          'node_modules/@firebase/firestore/dist/index.esm2017.js'
        ),
      };
    }
    return config;
  },
};

module.exports = nextConfig;
