/** @type {import('next').NextConfig} */
const repoName = 'Paper2PPT';
const isStaticExport = process.env.STATIC_EXPORT === 'true';

const nextConfig = {
  reactStrictMode: true,
  ...(isStaticExport
    ? {
        output: 'export',
        images: {
          unoptimized: true,
        },
        assetPrefix: `/${repoName}/`,
        basePath: `/${repoName}`,
      }
    : {}),
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias.canvas = false;
    config.resolve.fallback = config.resolve.fallback || {};
    config.resolve.fallback.fs = false;
    config.resolve.fallback.path = false;
    return config;
  },
};

module.exports = nextConfig;
