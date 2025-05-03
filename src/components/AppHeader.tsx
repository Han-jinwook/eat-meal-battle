'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

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
        </nav>
      </div>
    </header>
  );
}
