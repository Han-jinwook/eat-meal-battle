import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https', // http에서 https로 변경
        hostname: 'k.kakaocdn.net',
        port: '',
        pathname: '/dn/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // 구글 프로필 이미지
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
