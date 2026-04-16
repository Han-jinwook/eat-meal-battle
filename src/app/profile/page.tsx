import { createClient } from '@/lib/supabase-server'
import ProfileClient from '@/components/ProfileClient'
import ErrorBoundary from '@/components/ErrorBoundary'

export default async function ProfilePage() {
  const supabase = await createClient()
  
  // 서버에서 사용자 인증 확인
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  // 로그인하지 않아도 화면 구성 확인 가능하도록 기본값 처리
  let profileResult: PromiseSettledResult<any> = { status: 'fulfilled', value: { data: null, error: authError } }
  let schoolResult: PromiseSettledResult<any> = { status: 'fulfilled', value: { data: null, error: authError } }

  if (!authError && user) {
    [profileResult, schoolResult] = await Promise.allSettled([
      supabase.from('users').select('*').eq('id', user.id).single(),
      supabase.from('school_infos').select('*').eq('user_id', user.id).single()
    ])
  }
  
  // 데이터 추출
  const userProfile = profileResult.status === 'fulfilled' && !profileResult.value.error 
    ? profileResult.value.data 
    : null
  
  const schoolInfo = schoolResult.status === 'fulfilled' && !schoolResult.value.error 
    ? schoolResult.value.data 
    : null
  
  return (
    <ErrorBoundary>
      <ProfileClient 
        initialUser={user || null}
        initialUserProfile={userProfile}
        initialSchoolInfo={schoolInfo}
      />
    </ErrorBoundary>
  )
}
