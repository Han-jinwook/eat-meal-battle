"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import NotificationBell from '@/components/NotificationBell';
import { useState, useEffect, useRef } from 'react';

// 네비게이션 항목 정의
type NavItem = {
  label: string;
  href: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: '급식', href: '/' },
  { label: '퀴즈', href: '/quiz' },
  { label: '배틀', href: '/battle' },
  { label: '랭킹', href: '/ranking' },
];

export default function MainHeader() {
  const supabase = createClient();
  const pathname = usePathname();
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  
  // 사용자 정보 가져오기
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    
    fetchUser();
    
    // 인증 상태 변경 리스너
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase]);
  
  // 프로필 메뉴 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    
    // 프로필 메뉴가 열려있을 때만 이벤트 리스너 추가
    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileOpen]);

  const toggleProfile = () => setIsProfileOpen((p) => !p);
  const logout = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/40">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
        {/* 로고 */}
        <Link href="/" className="flex items-center text-lg font-bold text-indigo-600">
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
          {/* 알림 벨 - 로그인 상태일 때만 표시 */}
          {user && <NotificationBell />}

          {/* 프로필 또는 로그인 버튼 */}
          <div className="relative" ref={profileRef}>
            {user ? (
              // 로그인 상태: 사용자 프로필 이미지 표시
              <button
                onClick={toggleProfile}
                className="h-8 w-8 overflow-hidden rounded-full border border-gray-300"
              >
                <Image
                  src={user.user_metadata?.avatar_url || "/default-avatar.png"}
                  alt="avatar"
                  width={32}
                  height={32}
                />
              </button>
            ) : (
              // 비로그인 상태: 로그인 버튼 표시
              <Link href="/login" className="flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                로그인
              </Link>
            )}
            {user && isProfileOpen && (
              <div className="absolute right-0 mt-2 w-40 origin-top-right rounded-md border bg-white shadow-lg">
                <Link
                  href="/profile"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setIsProfileOpen(false)}
                >
                  프로필
                </Link>
                <Link
                  href="/school-search"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setIsProfileOpen(false)}
                >
                  학교설정 <span className="text-xs text-gray-500">(학부모가능)</span>
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
