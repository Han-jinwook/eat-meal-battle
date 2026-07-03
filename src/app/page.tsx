import { Metadata } from 'next';
import WhatEatApp from '@/components/whateat/WhatEatApp';

export const metadata: Metadata = {
  title: '뭐먹지? 나만의 맛집 서랍장',
  description: '나와 가족을 위한 식생활 기록 플랫폼. 기억하고 싶은 맛과 다시 가고 싶은 곳, 아이들의 맛있는 일상까지 \'뭐먹지?\' 하나로 간편하게 기록하고 관리하세요.',
  openGraph: {
    title: '뭐먹지? 나만의 맛집 서랍장',
    description: '나와 가족을 위한 식생활 기록 플랫폼. 기억하고 싶은 맛과 다시 가고 싶은 곳, 아이들의 맛있는 일상까지 \'뭐먹지?\' 하나로 간편하게 기록하고 관리하세요.',
    type: 'website',
    url: 'https://whateat.sundreamer.app',
    siteName: '뭐먹지?',
    images: [
      {
        url: 'https://whateat.sundreamer.app/og-image.png',
        width: 1200,
        height: 630,
        alt: '뭐먹지?',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '뭐먹지? - 나만의 맛집 서랍장',
    description: '나와 가족을 위한 식생활 기록 플랫폼. 기억하고 싶은 맛과 다시 가고 싶은 곳, 아이들의 맛있는 일상까지 \'뭐먹지?\' 하나로 간편하게 기록하고 관리하세요.',
    images: ['https://whateat.sundreamer.app/og-image.png'],
  },
};

// 동적 렌더링 강제 (모든 요청마다 서버에서 실행)
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

export default async function MealPage() {
  return <WhatEatApp />;
}
