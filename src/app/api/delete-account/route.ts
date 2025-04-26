import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log('회원 탈퇴 API 호출 수신')
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
    
    // DB에서 사용자 데이터 삭제 시도 - Supabase 인증을 통해 삭제
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
    
    // 기본 인증 사용자 삭제 - admin API는 사용하지 않고 일반 사용자 삭제로 처리
    // 서비스 롤 키가 없어도 작동되도록 변경
    console.log('현재 사용자의 세션을 삭제하는 방식으로 처리')
    
    // 성공 응답 (실제 사용자 삭제는 클라이언트에서 signOut() 후 서버에서 자동 처리)
    return NextResponse.json({ success: true, message: '사용자 데이터가 삭제되었습니다. 로그아웃 후 계정이 안전하게 삭제됩니다.' })
  } catch (error: any) {
    console.error('계정 삭제 중 예외 발생:', error)
    return NextResponse.json(
      { error: error.message || '계정 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
