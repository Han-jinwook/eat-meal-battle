// BACKUP: 이 파일은 사용되지 않음 - MainHeader.tsx가 실제 헤더
// 프로필 링크가 있지만 현재 사용되지 않음, 나중에 삭제 예정
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import NotificationBell from './NotificationBell';

export default function AppHeader() {
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };
    
    getUser();
  }, []);

  return (
    <header className="bg-white shadow-sm py-3 px-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-semibold text-gray-800">
          급식 정보 시스템
        </Link>
        
        <nav>
          <div className="flex items-center space-x-4">
            <ul className="flex space-x-4">
              <li>
                <Link href="/" className="text-gray-600 hover:text-gray-900">
                  홈
                </Link>
              </li>
              <li>
                <Link href="/profile" className="text-gray-600 hover:text-gray-900">
                  프로필
                </Link>
              </li>
            </ul>
            {user && (
              <div className="relative">
                <NotificationBell />
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
