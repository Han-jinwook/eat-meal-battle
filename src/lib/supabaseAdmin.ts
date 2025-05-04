import { createClient } from '@supabase/supabase-js'

// 서비스 롤 키를 사용하는 관리자 Supabase 클라이언트 생성
export const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase URL 또는 서비스 롤 키가 설정되지 않았습니다.')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
