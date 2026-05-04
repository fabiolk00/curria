/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
    outputFileTracingIncludes: {
      '/api/profile/smart-generation': [
        './src/lib/agent/job-targeting/catalog/**/*.json',
      ],
    },
  },
  async redirects() {
    return []
  },
}

module.exports = nextConfig
