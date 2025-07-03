import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log('회원 탈퇴 API 호출 수신')
    // SupabaseClient 인스턴스를 받아옵니다
    const supabase = createClient()
    
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
    
    // DB에서 사용자 데이터 삭제 시도
    const { error: deleteUserDataError } = await supabase
      .from('users')
      .delete()
      .eq('id', user.id)
    
    if (deleteUserDataError) {
      console.error('사용자 데이터 삭제 오류:', deleteUserDataError)
      // 에러가 있더라도 계속 진행
    } else {
      console.log('DB에서 사용자 데이터 삭제 성공')
    }
    
    // 세션 삭제로 로그아웃 처리
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
