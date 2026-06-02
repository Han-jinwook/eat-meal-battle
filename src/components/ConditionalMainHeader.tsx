'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import MainHeader from '@/components/MainHeader';

export default function ConditionalMainHeader() {
  const pathname = usePathname() || '';

  if (pathname === '/' || pathname.startsWith('/whateat') || pathname.startsWith('/profile') || pathname === '/login' || pathname.startsWith('/login')) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <MainHeader />
    </Suspense>
  );
}
