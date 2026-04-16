'use client';

import { usePathname } from 'next/navigation';
import MainHeader from '@/components/MainHeader';

export default function ConditionalMainHeader() {
  const pathname = usePathname() || '';

  if (pathname === '/' || pathname.startsWith('/whateat') || pathname.startsWith('/profile')) {
    return null;
  }

  return <MainHeader />;
}
