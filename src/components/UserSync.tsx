'use client';

import { useEffect } from 'react';
import { useHub } from '@/services/merlin-hub-sdk/react';
import { secureWrite } from '@/lib/supabase-safe';

/**
 * 전역 사용자 세션 동기화 컴포넌트
 * - Merlin Hub 로그인 세션을 감지하여 로컬 Supabase `users` 테이블에 동기화(upsert)합니다.
 * - 이를 통해 meal_images 등 로컬 테이블에 데이터를 삽입할 때 외래키 제약조건 위반을 방지합니다.
 */
export default function UserSync() {
  const { isLoggedIn, user, isLoading } = useHub();

  useEffect(() => {
    if (!isLoading && isLoggedIn && user?.id) {
      const syncUser = async () => {
        try {
          await secureWrite({
            table: 'users',
            action: 'upsert',
            data: {
              id: user.id,
              nickname: user.nickname || '가족',
              email: user.email || '',
              profile_image: user.avatar_url || '',
              provider: 'local',
              provider_id: user.id,
              is_student: false
            }
          });
          console.log('[UserSync] Local user synced successfully:', user.id);
        } catch (err) {
          console.error('[UserSync] Failed to sync local user:', err);
        }
      };
      syncUser();
    }
  }, [isLoggedIn, user, isLoading]);

  return null;
}
