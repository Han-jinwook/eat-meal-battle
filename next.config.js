/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: true, // 일시적으로 PWA 비활성화
});

const path = require('path');

const nextConfig = {
  // Netlify에서 API 라우트 지원을 위한 설정
  output: 'standalone',
  trailingSlash: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google 프로필 이미지
      { protocol: 'https', hostname: 'k.kakaocdn.net' },           // 카카오 프로필 이미지
      { protocol: 'https', hostname: 'i.imgur.com' },              // Imgur 이미지 (테스트용)
      { protocol: 'https', hostname: 'images.unsplash.com' },      // Unsplash 이미지 (테스트용)
      { 
        protocol: 'https', 
        hostname: 'izkumvvlkrkgiuuczffp.supabase.co',
        pathname: '/storage/v1/object/public/**', // Supabase Storage 패턴 정확히 일치
      },
    ],
    // 404 오류 방지를 위한 추가 설정
    unoptimized: process.env.NODE_ENV === 'development', // 개발 환경에서만 이미지 최적화 비활성화
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/webp'],
    minimumCacheTTL: 60,
    disableStaticImages: false,
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // 빌드 시 ESLint 검사 비활성화
  eslint: {
    ignoreDuringBuilds: true,
  },

  // 빌드 시 타입 검사 비활성화 (Netlify 배포를 위한 설정)
  typescript: {
    ignoreBuildErrors: true,
  },

  // Webpack 설정: '@/...' 별칭을 src 디렉토리로 매핑
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    return config;
  },
}

module.exports = withPWA(nextConfig);
