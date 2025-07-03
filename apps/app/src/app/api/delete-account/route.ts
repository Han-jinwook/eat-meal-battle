import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log('회원 탈퇴 API 호출 수신')
    
    // 요청 본문에서 사용자 ID 가져오기
    const body = await request.json()
    const { user_id } = body
    
    if (!user_id) {
      console.error('사용자 ID가 없습니다.')
      return NextResponse.json(
        { error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      )
    }
    
    console.log('회원 탈퇴 - 사용자 ID:', user_id)
    
    // Supabase 클라이언트 생성 (Admin 키 사용)
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    
    // DB에서 사용자 데이터 삭제 시도
    const { error: deleteUserDataError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', user_id)
    
    if (deleteUserDataError) {
      console.error('사용자 데이터 삭제 오류:', deleteUserDataError)
      return NextResponse.json(
        { error: '사용자 데이터 삭제 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    } 
    
    console.log('DB에서 사용자 데이터 삭제 성공')
    
    // Auth에서도 사용자 삭제
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user_id)
    
    if (deleteAuthError) {
      console.error('Auth 사용자 삭제 오류:', deleteAuthError)
      // Auth 삭제 실패해도 DB는 삭제됨
    } else {
      console.log('Auth에서 사용자 계정 삭제 성공')
    }
    
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
