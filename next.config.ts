import type { NextConfig } from 'next';

// The browser calls the Express API directly (see src/lib/api.ts) rather than through
// a Next rewrite, so Express sees each browser's real IP for its ALLOWED_IPS check.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
};

export default nextConfig;
