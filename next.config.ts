import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // Enable standalone output for Docker
  // Skip static optimization for pages that require runtime environment variables
  // This prevents build errors when NEXT_PUBLIC_* variables aren't available during build
  experimental: {
    // Disable static page generation during build to avoid Clerk/Supabase initialization errors
    // Pages will be rendered on-demand at runtime
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
