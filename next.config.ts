import type { NextConfig } from 'next';

// The browser calls the extraction service directly (see src/modules/service/client.ts) rather
// than through a Next rewrite, so it sees each browser's real IP for its ALLOWED_IPS check.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  // Old /admin links: users moved to /users, country details to each country's page
  redirects: async () => [
    { source: '/admin/countries/:path*', destination: '/countries', permanent: true },
    { source: '/admin/:path*', destination: '/users', permanent: true },
  ],
};

export default nextConfig;
