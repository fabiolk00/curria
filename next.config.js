/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
  async redirects() {
    return [
      { source: '/signup', destination: '/criar-conta', permanent: true },
      { source: '/pricing', destination: '/precos', permanent: true },
      { source: '/privacy', destination: '/privacidade', permanent: true },
    ]
  },
}

module.exports = nextConfig
