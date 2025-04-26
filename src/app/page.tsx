'use client';

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Home() {
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
            <div className="flex gap-4">
              <Link
                href="/profile"
                className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
              >
                내 프로필
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
              className="rounded-md bg-indigo-600 px-6 py-3 text-white hover:bg-indigo-700 inline-block"
            >
              지금 시작하기
            </Link>
          )}

          {user && (
            <div className="mt-4 p-4 bg-green-50 rounded-md text-green-700 text-sm">
              <strong>{user.app_metadata?.provider}</strong> 계정으로 로그인되었습니다.
              <div className="mt-2 text-xs text-gray-600">
                사용자 ID: {user.id}
              </div>
            </div>
          )}
        </div>

        {/* 디버깅 정보 영역 */}
        <div className="p-6 rounded-lg bg-gray-50 border border-gray-200 w-full max-w-3xl">
          <h3 className="text-lg font-bold mb-2">로그인 상태 디버깅</h3>
          <div className="bg-gray-100 p-3 rounded text-sm font-mono break-all">
            {debugInfo || '디버깅 정보 없음'}
          </div>
          
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-bold">세션 정보</h4>
              <div className="bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                {session ? (
                  <pre className="text-xs">
                    {JSON.stringify({ 
                      access_token: session.access_token ? '존재함' : '없음',
                      refresh_token: session.refresh_token ? '존재함' : '없음',
                      expires_at: session.expires_at,
                      user_id: session.user?.id
                    }, null, 2)}
                  </pre>
                ) : '세션 없음'}
              </div>
            </div>
            
            <div>
              <h4 className="font-bold">사용자 정보</h4>
              <div className="bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                {user ? (
                  <pre className="text-xs">
                    {JSON.stringify({
                      id: user.id,
                      email: user.email,
                      provider: user.app_metadata?.provider,
                      created_at: user.created_at
                    }, null, 2)}
                  </pre>
                ) : '사용자 정보 없음'}
              </div>
            </div>
          </div>
          
          {user && (
            <div className="mt-4 flex justify-end">
              <button 
                onClick={async () => {
                  const { error } = await supabase.auth.signOut();
                  if (error) {
                    console.error('로그아웃 오류:', error);
                    setDebugInfo('Sign-out error: ' + error.message);
                  }
                }}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              >
                로그아웃
              </button>
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
            <h3 className="text-xl font-bold mb-3">회원 관리</h3>
            <p className="text-gray-600 mb-4">
              로그아웃 및 회원 탈퇴 기능으로 계정을 안전하게 관리할 수 있습니다.
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
