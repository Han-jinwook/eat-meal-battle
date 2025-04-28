/** @type {import('next').NextConfig} */
const nextConfig = {
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
}

module.exports = nextConfig
