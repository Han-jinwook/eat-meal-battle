"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { SupabaseClient, User } from '@supabase/supabase-js';

// User 타입을 확장하여 필요한 필드 추가
type ExtendedUser = User & {
  profile_image?: string;
};
import NotificationBell from '@/components/NotificationBell';
import ImageWithFallback from '@/components/ImageWithFallback';
import { useState, useEffect, useRef } from 'react';
import ProfileModal from '@/components/ProfileModal';

// 네비게이션 항목 정의
type NavItem = {
  label: string;
  href: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: '급식', href: '/' },
  { label: '배틀', href: '/battle' },
  { label: '퀴즈', href: '/quiz' },
];

import useUserSchool from '@/hooks/useUserSchool';

export default function MainHeader() {
  // 명시적인 타입 정의로 SupabaseClient 타입 적용
  const supabase = createClient() as SupabaseClient;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  // any 대신 확장된 User 타입 사용
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  
  // 사용자 정보 가져오기
  const [nickname, setNickname] = useState<string | null>(null);

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

  // 프로필 이미지 클릭 시 바로 프로필 페이지로 이동
  const navigateToProfile = () => router.push('/profile');
  const logout = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/40">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
        <Link href="/" className="text-lg sm:text-xl font-bold text-gray-900">
          뭐먹지?
        </Link>

        {/* 메인 메뉴 - 모바일에서도 표시 */}
        <nav className="flex overflow-x-auto gap-3 sm:gap-6 px-1 py-1 -mx-1 scrollbar-hide">
          {NAV_ITEMS.map((item) => {
            // 현재 URL의 date 파라미터를 다른 페이지로 전달
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
                className={`text-xs sm:text-sm font-medium whitespace-nowrap px-2 py-1 rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-colors ${
                  // 홈 경로('/')(급식 메뉴)의 경우 정확히 일치할 때만 강조
                  item.href === '/' 
                    ? (pathname === '/' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700')
                    : (pathname.startsWith(item.href) ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700')
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
          {/* 알림 벨 - 로그인 상태일 때만 표시 */}
          {user && <NotificationBell />}

          {/* 프로필 또는 로그인 버튼 */}
          <div className="relative" ref={profileRef}>
            {user ? (
              // 로그인 상태: 사용자 프로필 이미지 표시
              <button
                onClick={navigateToProfile}
                className="relative h-8 w-8 overflow-hidden rounded-full border border-gray-300 bg-white hover:border-indigo-500 transition-colors"
              >
                {(() => {
                  // 메모에서 언급한 대로 user.user_metadata.avatar_url 사용
                  let avatarUrl = user.user_metadata?.avatar_url as string | undefined;
                  
                  // 카카오 프로필 이미지 URL이 http로 시작하는 경우 https로 변환
                  if (avatarUrl && avatarUrl.startsWith('http://')) {
                    avatarUrl = avatarUrl.replace('http://', 'https://');
                    console.log('Profile image URL changed to HTTPS:', avatarUrl);
                  }
                  
                  // users 테이블의 nickname 사용
                  const nicknameToDisplay = nickname;

                  if (avatarUrl) {
                    return (
                      <img
                        src={avatarUrl}
                        alt={nicknameToDisplay || 'User Avatar'}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          // 이미지 로드 실패 시 닉네임 이니셜로 대체
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
                    // 이미지 URL이 없으면 닉네임 첫 글자 표시
                    const initial = nicknameToDisplay.charAt(0).toUpperCase();
                    return (
                      <div className="flex h-full w-full items-center justify-center bg-slate-300 text-slate-700 text-sm font-semibold">
                        {initial}
                      </div>
                    );
                  } else {
                    // 닉네임도 없는 경우 기본 아이콘 표시
                    return (
                      <div className="flex h-full w-full items-center justify-center bg-gray-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    );
                  }
                })()}
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
            {/* 모달 메뉴 제거: 프로필 이미지 클릭 시 바로 프로필 페이지로 이동 */}
          </div>
        </div>
      </div>
    </header>
  );
}
