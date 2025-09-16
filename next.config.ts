import type { NextConfig } from "next";

const ContentSecurityPolicy = `
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.googleapis.com https://*.firebase.com wss://*.firebaseio.com https://firestore.googleapis.com;
`;

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: ContentSecurityPolicy.replace(/\s{2,}/g, ' ').trim(),
          },
        ],
      },
    ];
  },
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
