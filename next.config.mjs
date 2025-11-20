/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
  // Ensure static files are served correctly
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  // Disable static file optimization issues
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
};
export default nextConfig;

