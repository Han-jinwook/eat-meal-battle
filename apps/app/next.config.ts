import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'http', // 또는 'https'
        hostname: 'k.kakaocdn.net',
        port: '',
        pathname: '/dn/**',
      },
    ],
  },
};

export default nextConfig;
