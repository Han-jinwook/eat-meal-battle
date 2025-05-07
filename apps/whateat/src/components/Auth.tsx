'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@meal-battle/auth';
import type { User } from '@meal-battle/types';

interface AuthProps {
  children: React.ReactNode;
}

export default function Auth({ children }: AuthProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // 현재 세션 확인
    const checkUser = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('세션 확인 중 오류:', error);
          setUser(null);
        } else if (data.session) {
          setUser(data.session.user as User);
        }
      } catch (err) {
        console.error('인증 초기화 중 오류:', err);
      } finally {
        setLoading(false);
      }
    };

    // 인증 상태 변경 구독
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          setUser(session.user as User);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    checkUser();

    // 컴포넌트 언마운트 시 구독 해제
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <div className="auth-container">
      {loading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
