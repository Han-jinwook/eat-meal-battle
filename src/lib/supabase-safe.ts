import { getSessionToken } from '@/services/merlin-hub-sdk/CoreLogic/client';

export interface SecureWriteOptions {
  table: string;
  action: 'insert' | 'update' | 'upsert' | 'delete';
  data?: any;
  filters?: Record<string, any>;
}

/**
 * Supabase의 쓰기/삭제 작업을 RLS 정책을 우회하여 서버 사이드에서 안전하게 처리하기 위한 프론트엔드 유틸리티 함수입니다.
 */
export async function secureWrite(options: SecureWriteOptions) {
  const token = getSessionToken();
  
  const res = await fetch('/api/db/write', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify(options),
  });

  const result = await res.json();
  
  if (!res.ok) {
    throw new Error(result.error || '데이터베이스 작업 중 오류가 발생했습니다.');
  }

  return result;
}
