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
        } catch (err: any) {
          console.error('[UserSync] Failed to sync local user:', err);
          // 이메일 중복 제약조건 충돌 시 고유한 이메일 접미사를 붙여 재시도
          if (err.message && err.message.includes('users_email_key')) {
            try {
              const email = user.email || '';
              const uniqueEmail = email.includes('@') 
                ? `${email.split('@')[0]}+${user.id.substring(0, 8)}@${email.split('@')[1]}`
                : `user_${user.id.substring(0, 8)}@merlin.com`;
              
              await secureWrite({
                table: 'users',
                action: 'upsert',
                data: {
                  id: user.id,
                  nickname: user.nickname || '가족',
                  email: uniqueEmail,
                  profile_image: user.avatar_url || '',
                  provider: 'local',
                  provider_id: user.id,
                  is_student: false
                }
              });
              console.log('[UserSync] Local user synced with unique email suffix:', user.id);
            } catch (retryErr) {
              console.error('[UserSync] Retry sync failed:', retryErr);
            }
          }
        }
      };
      syncUser();
    }
  }, [isLoggedIn, user, isLoading]);

  return null;
}
