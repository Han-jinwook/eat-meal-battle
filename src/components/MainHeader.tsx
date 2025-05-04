"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import NotificationBell from '@/components/NotificationBell';
import { useState } from 'react';

// 네비게이션 항목 정의
type NavItem = {
  label: string;
  href: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: '급식', href: '/meal' },
  { label: '배틀', href: '/battle' },
  { label: '랭킹', href: '/ranking' },
];

export default function MainHeader() {
  const supabase = createClient();
  const pathname = usePathname();
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const toggleProfile = () => setIsProfileOpen((p) => !p);
  const logout = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/40">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
        {/* 로고 */}
        <Link href="/meal" className="flex items-center text-lg font-bold text-indigo-600">
          <span className="mr-2 hidden sm:inline">🍱</span> 급식배틀
        </Link>

        {/* 메인 메뉴 */}
        <nav className="hidden gap-6 sm:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium hover:text-indigo-600 ${
                pathname.startsWith(item.href) ? 'text-indigo-600' : 'text-gray-700'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {/* 알림 벨 */}
          <NotificationBell />

          {/* 프로필 */}
          <div className="relative">
            <button
              onClick={toggleProfile}
              className="h-8 w-8 overflow-hidden rounded-full border border-gray-300"
            >
              <Image
                src="/default-avatar.png"
                alt="avatar"
                width={32}
                height={32}
              />
            </button>
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-40 origin-top-right rounded-md border bg-white shadow-lg">
                <Link
                  href="/profile"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setIsProfileOpen(false)}
                >
                  프로필
                </Link>
                <Link
                  href="/settings/school"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setIsProfileOpen(false)}
                >
                  학교 설정
                </Link>
                <button
                  onClick={logout}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                >
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
