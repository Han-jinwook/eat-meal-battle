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
    domains: [
      'lh3.googleusercontent.com', // Google 프로필 이미지
      'k.kakaocdn.net',           // 카카오 프로필 이미지
      'i.imgur.com',              // Imgur 이미지 (테스트용)
      'images.unsplash.com',      // Unsplash 이미지 (테스트용)
      'izkumvvlkrkgiuuczffp.supabase.co', // Supabase Storage 이미지
    ],
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
