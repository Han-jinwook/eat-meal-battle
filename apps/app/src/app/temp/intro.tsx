'use client';

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";

export default function IntroPage() {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const getSession = async () => {
      try {
        setLoading(true);
        // 세션 정보 조회
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('세션 조회 오류:', sessionError);
          setDebugInfo('Session error: ' + sessionError.message);
          return;
        }
        
        setSession(session);
        
        if (session) {
          // 세션이 있으면 사용자 정보 조회
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          
          if (userError) {
            console.error('사용자 정보 조회 오류:', userError);
            setDebugInfo('User error: ' + userError.message);
            return;
          }
          
          setUser(user);
          console.log('사용자 정보 가져오기 성공:', user);
          setDebugInfo(`User found: ${user?.email} (${user?.id})`);
        } else {
          setDebugInfo('No active session found');
        }
      } catch (error: any) {
        console.error('사용자 정보 조회 오류:', error);
        setDebugInfo('Error: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    getSession();
    
    // 세션 변경 이벤트 구독
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        setSession(session);
        setUser(session?.user || null);
        
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
          setDebugInfo('User signed out');
        } else if (event === 'SIGNED_IN') {
          setDebugInfo(`User signed in: ${session?.user?.email}`);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <div className="min-h-screen p-8 pb-20 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <header className="flex justify-between items-center mb-12">
        <h1 className="text-3xl font-bold">급식배틀</h1>
        <div>
          {loading ? (
            <div className="h-5 w-20 bg-gray-200 animate-pulse rounded-md"></div>
          ) : user ? (
            <div className="flex items-center gap-3">
              <div className="relative mr-2">
                <NotificationBell />
              </div>
              <Link
                href="/profile"
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700"
              >
                내 프로필
              </Link>
              <Link
                href="/temp/school-search"
                className="rounded-md bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700"
              >
                학교설정
              </Link>
              <Link
                href="/temp/meals"
                className="rounded-md bg-orange-600 px-3 py-2 text-sm text-white hover:bg-orange-700"
              >
                급식보기
              </Link>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
            >
              로그인
            </Link>
          )}
        </div>
      </header>

      <main className="flex flex-col gap-[32px] items-center">
        <div className="p-6 rounded-lg bg-white shadow-md w-full max-w-3xl text-center">
          <h2 className="text-2xl font-bold mb-4">급식배틀에 오신 것을 환영합니다!</h2>
          <p className="text-gray-600 mb-6">
            소셜 로그인으로 간편하게 회원가입하고 다양한 기능을 이용해보세요.
          </p>

          {!user && (
            <Link
              href="/login"
              className="inline-block py-3 px-5 bg-indigo-600 text-white font-medium text-center rounded-md hover:bg-indigo-700 transition"
            >
              로그인하러 가기
            </Link>
          )}

          {user && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto">
              <Link
                href="/profile"
                className="flex flex-col items-center justify-center p-4 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition"
              >
                <span className="text-2xl mb-2">👤</span>
                <span className="font-medium text-indigo-700">내 프로필</span>
              </Link>
              <Link
                href="/temp/school-search"
                className="flex flex-col items-center justify-center p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition"
              >
                <span className="text-2xl mb-2">🏫</span>
                <span className="font-medium text-green-700">학교설정</span>
              </Link>
              <Link
                href="/temp/meals"
                className="flex flex-col items-center justify-center p-4 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition"
              >
                <span className="text-2xl mb-2">🍱</span>
                <span className="font-medium text-orange-700">급식보기</span>
              </Link>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
          <div className="p-6 rounded-lg bg-white shadow-md">
            <h3 className="text-xl font-bold mb-3">소셜 로그인</h3>
            <p className="text-gray-600 mb-4">
              구글과 카카오 계정으로 간편하게 로그인할 수 있습니다.
            </p>
          </div>

          <div className="p-6 rounded-lg bg-white shadow-md">
            <h3 className="text-xl font-bold mb-3">급식 평가</h3>
            <p className="text-gray-600 mb-4">
              매일 학교 급식을 평가하고 다른 학생들과 의견을 나눠보세요.
            </p>
          </div>
        </div>
      </main>

      <footer className="mt-16 flex gap-[24px] flex-wrap items-center justify-center text-gray-500 text-sm">
        <p>© 2025 급식배틀. All rights reserved.</p>
      </footer>
    </div>
  );
}
