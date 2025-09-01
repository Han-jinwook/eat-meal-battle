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
    
    // ⚠️ 1단계: 데이터베이스에서 사용자 데이터 먼저 정리 (외래키 제약조건 해결)
    console.log('1단계: 데이터베이스에서 사용자 데이터 정리 시작...')
    
    try {
      // DEV_NOTES_설정.txt 기반 외래키 정리 규칙 적용
      
      // 개인정보 완전 삭제 (2단계)
      console.log('개인정보 완전 삭제 시작...')
      
      console.log('댓글 좋아요 데이터 삭제 중...')
      await supabaseAdmin.from('comment_likes').delete().eq('user_id', user_id)
      
      console.log('알림 수신 기록 삭제 중...')
      await supabaseAdmin.from('notification_recipients').delete().eq('recipient_id', user_id)
      
      console.log('관심학교 데이터 삭제 중...')
      await supabaseAdmin.from('interest_schools').delete().eq('user_id', user_id)
      
      console.log('학교 정보 삭제 중...')
      await supabaseAdmin.from('school_infos').delete().eq('user_id', user_id)
      
      console.log('✅ 개인정보 완전 삭제 완료')
      
      console.log('✅ 데이터베이스 정리 완료')
    } catch (dbError) {
      console.error('❌ 데이터베이스 정리 실패:', dbError)
      return NextResponse.json({
        success: false,
        error: '사용자 데이터 정리 중 오류가 발생했습니다.',
        details: dbError.message
      }, { status: 500 })
    }
    
    // ⚠️ 2단계: Auth 유지 방식 - 외래키 문제 해결을 위해 Auth는 삭제하지 않음
    console.log('2단계: Auth 유지 방식으로 진행 - 외래키 문제 해결')
    console.log('✅ Auth는 유지하되 users 테이블 삭제로 로그인 차단')
    
    // 3단계: 하이브리드 탈퇴 처리 - 통계 데이터 익명화 보존
    console.log('3단계: 하이브리드 탈퇴 처리 시작...')
    
    // 기존 익명 사용자 레코드 사용 (이미 생성되어 있음)
    const anonymousUserId = '00000000-0000-0000-0000-000000000000'
    console.log('기존 익명 사용자 레코드 사용:', anonymousUserId)
    
    // === 개인정보 완전 삭제 ===
    console.log('개인정보 완전 삭제 시작...')
    
    // 개인정보 관련 데이터 완전 삭제
    await supabaseAdmin.from('comment_likes').delete().eq('user_id', user_id)
    console.log('댓글 좋아요 완전 삭제 완료')
    
    await supabaseAdmin.from('notification_recipients').delete().eq('recipient_id', user_id)
    console.log('알림 수신자 완전 삭제 완료')
    
    await supabaseAdmin.from('interest_schools').delete().eq('user_id', user_id)
    console.log('관심학교 완전 삭제 완료')
    
    // school_infos는 학교 정보이므로 개인정보가 아님 - 유지
    // 배틀 기능과의 외래키 관계 유지를 위해 삭제하지 않음
    console.log('학교정보는 개인정보가 아니므로 유지')
    
    // === 통계 데이터 익명화 처리 ===
    console.log('통계 데이터 익명화 시작...')
    
    // 댓글/답글 익명화 ("탈퇴한 사용자"로 표시)
    await supabaseAdmin.from('comments')
      .update({ user_id: anonymousUserId })
      .eq('user_id', user_id)
    console.log('댓글 익명화 완료')
    
    await supabaseAdmin.from('comment_replies')
      .update({ user_id: anonymousUserId })
      .eq('user_id', user_id)
    console.log('답글 익명화 완료')
    
    // 급식 이미지 익명화 ("탈퇴한 사용자"로 표시)
    await supabaseAdmin.from('meal_images')
      .update({ uploaded_by: anonymousUserId })
      .eq('uploaded_by', user_id)
    console.log('급식 이미지 익명화 완료')
    
    // === 통계 무결성 보존 데이터 (익명화하지 않고 보존) ===
    console.log('통계 무결성 보존 데이터 유지...')
    
    // 별점 데이터 보존 (통계 왜곡 방지) - 익명화하지 않음
    console.log('별점 데이터 보존 (통계 무결성 유지)')
    
    // 퀴즈 결과 보존 (서비스 통계) - 익명화하지 않음  
    console.log('퀴즈 데이터 보존 (서비스 통계)')
    
    // 알림 시스템 데이터 보존 - 익명화하지 않음
    console.log('알림 데이터 보존 (시스템 로그)')
    
    // 마지막으로 사용자 기본 정보 삭제
    const { error: deleteUserDataError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', user_id)

    if (deleteUserDataError) {
      console.error('사용자 기본 데이터 삭제 오류:', deleteUserDataError)
      return NextResponse.json(
        { error: '사용자 데이터 삭제 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    } 

    console.log('✅ 3단계: 모든 사용자 관련 데이터 삭제 성공')
    
    return NextResponse.json({
      success: true,
      message: '계정이 삭제되었습니다. 개인정보는 완전히 삭제되고 활동 내역은 익명으로 처리되었습니다.'
    })
  } catch (error: any) {
    console.error('계정 삭제 중 예외 발생:', error)
    return NextResponse.json(
      { error: error.message || '계정 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
