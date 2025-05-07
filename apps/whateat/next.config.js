/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@meal-battle/ui",
    "@meal-battle/auth",
    "@meal-battle/utils",
    "@meal-battle/types"
  ],
  images: {
    domains: ['jtllfufpefnkzcwvjirt.supabase.co']
  },
  experimental: {
    serverActions: true
  }
};

module.exports = nextConfig;
