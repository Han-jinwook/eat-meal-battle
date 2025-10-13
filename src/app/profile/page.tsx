import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ProfileClient from '@/components/ProfileClient'
import ErrorBoundary from '@/components/ErrorBoundary'

export default async function ProfilePage() {
  const supabase = createClient()
  
  // 서버에서 사용자 인증 확인
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/login')
  }
  
  // 서버에서 데이터 병렬 로드 (빠름!)
  const [profileResult, schoolResult] = await Promise.allSettled([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('school_infos').select('*').eq('user_id', user.id).single()
  ])
  
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
        initialUser={user}
        initialUserProfile={userProfile}
        initialSchoolInfo={schoolInfo}
      />
    </ErrorBoundary>
  )
}
