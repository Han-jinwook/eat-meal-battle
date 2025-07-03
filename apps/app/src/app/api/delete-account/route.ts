import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log('회원 탈퇴 API 호출 수신')
    // SupabaseClient 인스턴스를 await로 받아옵니다
    const supabase = await createClient()
    
    // 현재 로그인된 사용자 정보 가져오기
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('인증된 사용자를 찾을 수 없음:', userError)
      return NextResponse.json(
        { error: '인증된 사용자를 찾을 수 없습니다.' },
        { status: 401 }
      )
    }
    
    console.log('회원 탈퇴 - 사용자 ID:', user.id)
    
    // 1단계: 관련 데이터 삭제 (외래키 관계 순서대로)
    
    // quiz_results 삭제
    const { error: deleteQuizResultsError } = await supabase
      .from('quiz_results')
      .delete()
      .eq('user_id', user.id)
    
    if (deleteQuizResultsError) {
      console.error('퀴즈 결과 삭제 오류:', deleteQuizResultsError)
    } else {
      console.log('퀴즈 결과 삭제 성공')
    }
    
    // quiz_champions 삭제
    const { error: deleteChampionsError } = await supabase
      .from('quiz_champions')
      .delete()
      .eq('user_id', user.id)
    
    if (deleteChampionsError) {
      console.error('챔피언 데이터 삭제 오류:', deleteChampionsError)
    } else {
      console.log('챔피언 데이터 삭제 성공')
    }
    
    // users 테이블에서 사용자 데이터 삭제
    const { error: deleteUserDataError } = await supabase
      .from('users')
      .delete()
      .eq('id', user.id)
    
    if (deleteUserDataError) {
      console.error('사용자 데이터 삭제 오류:', deleteUserDataError)
      return NextResponse.json(
        { error: '사용자 데이터 삭제 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    } else {
      console.log('DB에서 사용자 데이터 삭제 성공')
    }
    
    // 2단계: Supabase Auth에서 사용자 계정 완전 삭제 (Admin 권한 필요)
    const adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(user.id)
    
    if (deleteAuthError) {
      console.error('Auth 사용자 삭제 오류:', deleteAuthError)
      // Auth 삭제 실패해도 이미 DB는 삭제됨
    } else {
      console.log('Auth에서 사용자 계정 삭제 성공')
    }
    
    // 3단계: 세션 로그아웃 처리
    await supabase.auth.signOut()
    console.log('세션 로그아웃 처리 완료')
    
    return NextResponse.json({
      success: true,
      message: '사용자 데이터가 삭제되었습니다. 로그아웃이 완료되었습니다.'
    })
  } catch (error: any) {
    console.error('계정 삭제 중 예외 발생:', error)
    return NextResponse.json(
      { error: error.message || '계정 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
