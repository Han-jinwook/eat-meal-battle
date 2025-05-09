'use client';

import { useState, useEffect } from 'react';
import { createClient, getUser } from '@meal-battle/auth';
import type { User } from '@meal-battle/types';
import { useRouter } from 'next/navigation';

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadUser() {
      try {
        const userData = await getUser();
        setUser(userData);
      } catch (error) {
        console.error('사용자 정보 로드 중 오류:', error);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('로그아웃 중 오류:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4">
        <p className="text-gray-600">로그인이 필요합니다.</p>
        <button
          onClick={() => router.push('/login')}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          로그인하기
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <div className="flex items-center space-x-4">
        {user.user_metadata?.avatar_url && (
          <img
            src={user.user_metadata.avatar_url.replace(/^http:\/\//i, 'https://')}
            alt="User"
            className="rounded-full w-24 h-24 mb-4"
          />
        )}
        <div>
          <h3 className="font-medium text-gray-900">
            {user.user_metadata?.full_name || user.email}
          </h3>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
      </div>

      <div className="mt-4 border-t pt-4">
        <p className="text-sm text-gray-600">
          앱: <span className="font-medium">WhatEat</span>
        </p>
        <p className="text-sm text-gray-600">
          계정 타입: <span className="font-medium">{user.app_metadata?.provider || '이메일'}</span>
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <a
          href="/"
          className="text-sm text-blue-600 hover:underline"
        >
          Meal Battle로 이동
        </a>
        <button
          onClick={handleSignOut}
          className="px-3 py-1 text-sm text-white bg-red-600 rounded-md hover:bg-red-700"
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}
