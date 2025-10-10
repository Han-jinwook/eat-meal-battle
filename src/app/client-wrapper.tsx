'use client';

import dynamic from 'next/dynamic';

// ssr: false를 허용하는 클라이언트 컴포넌트
const MealClient = dynamic(() => import('./MealClient'), { ssr: false });

export default function MealWrapper() {
  return <MealClient />;
}
