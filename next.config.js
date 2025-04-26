/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'lh3.googleusercontent.com', // Google 프로필 이미지
      'k.kakaocdn.net',           // 카카오 프로필 이미지
      'i.imgur.com',              // Imgur 이미지 (테스트용)
      'images.unsplash.com',      // Unsplash 이미지 (테스트용)
    ],
  },
}

module.exports = nextConfig
