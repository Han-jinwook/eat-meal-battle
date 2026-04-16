"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { SupabaseClient, User } from '@supabase/supabase-js';
import NotificationBell from '@/components/NotificationBell';
import useUserSchool from '@/hooks/useUserSchool';

// User 타입을 확장하여 필요한 필드 추가
type ExtendedUser = User & {
  profile_image?: string;
};

// 네비게이션 항목 정의
type NavItem = {
  label: string;
  href: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: '급식', href: '/' },
];

export default function MainHeader() {
  const supabase = createClient() as SupabaseClient;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    
    fetchUser();
    
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    const fetchNickname = async () => {
      if (user?.id) {
        const { data: userData, error } = await supabase
          .from('users')
          .select('nickname')
          .eq('id', user.id)
          .single();
          
        if (!error && userData) {
          setNickname(userData.nickname);
        } else {
          setNickname(user.user_metadata?.name || null);
        }
      } else {
        setNickname(null);
      }
    };
    
    fetchNickname();
  }, [user?.id, supabase]);

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  const navigateToProfile = () => {
    if (isNavigating) return;
    setIsNavigating(true);
    router.push('/profile');
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-yellow-400 backdrop-blur">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center">
          <img src="/images/logo.png" alt="급식배틀" className="h-8 w-auto lg:h-10" />
        </Link>

        <nav className="flex overflow-x-auto gap-1 sm:gap-2 px-1 py-1 -mx-1 scrollbar-hide">
          {NAV_ITEMS.map((item) => {
            const currentDate = searchParams?.get('date');
            const linkHref = currentDate ? `${item.href}?date=${currentDate}` : item.href;
            
            // 네비게이션 차단 핸들러
            const handleNavigation = (e: React.MouseEvent<HTMLAnchorElement>) => {
              // AI 검증 실패 이미지가 있는지 확인
              const hasRejectedImage = typeof window !== 'undefined' && (window as any).hasRejectedImage;
              console.log('📍 MainHeader - 메뉴 네비게이션 시도:', { href: item.href, hasRejectedImage, rejectedImageId: (window as any)?.rejectedImageId });
              
              if (hasRejectedImage) {
                e.preventDefault();
                const confirmed = window.confirm(
                  'AI 검증에 실패한 이미지가 있습니다. 먼저 해당 이미지를 삭제해주세요.\n\n삭제하고 계속하시겠습니까?'
                );
                
                if (confirmed) {
                  // 전역 플래그 해제
                  (window as any).hasRejectedImage = false;
                  (window as any).rejectedImageId = null;
                  // 네비게이션 진행
                  router.push(linkHref);
                }
                // confirmed가 false면 네비게이션 취소
              }
            };

            return (
              <Link
                key={item.href}
                href={linkHref}
                onClick={handleNavigation}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold transition-all duration-200 lg:px-4 lg:py-3 lg:text-base ${
                  pathname === item.href
                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg transform scale-105'
                    : 'text-gray-700 hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-200 hover:text-gray-900 hover:shadow-md hover:scale-102'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {user && <NotificationBell />}
          
          {user ? (
            <button
              onClick={navigateToProfile}
              disabled={isNavigating}
              className="relative h-8 w-8 overflow-hidden rounded-full bg-gray-200 hover:bg-gray-300 transition-colors disabled:opacity-50 lg:h-10 lg:w-10"
            >
              {isNavigating ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="animate-spin h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : (
                <>
                  {(() => {
                    let avatarUrl = user.user_metadata?.avatar_url as string | undefined;
                    
                    if (avatarUrl && avatarUrl.startsWith('http://')) {
                      avatarUrl = avatarUrl.replace('http://', 'https://');
                    }
                    
                    const nicknameToDisplay = nickname;

                    if (avatarUrl) {
                      return (
                        <img
                          src={avatarUrl}
                          alt={nicknameToDisplay || 'User Avatar'}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent && nicknameToDisplay) {
                              parent.classList.add('flex', 'items-center', 'justify-center', 'bg-slate-300');
                              parent.textContent = nicknameToDisplay.charAt(0).toUpperCase();
                            }
                          }}
                        />
                      );
                    } else if (nicknameToDisplay) {
                      const initial = nicknameToDisplay.charAt(0).toUpperCase();
                      return (
                        <div className="flex h-full w-full items-center justify-center bg-slate-300 text-slate-700 text-sm font-semibold">
                          {initial}
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex h-full w-full items-center justify-center bg-gray-200">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      );
                    }
                  })()}
                </>
              )}
            </button>
          ) : (
            <Link href="/login" className="flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
