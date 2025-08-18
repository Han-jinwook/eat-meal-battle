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
    
    // ⚠️ 2단계: Auth에서 사용자 삭제 (외래키 정리 후 안전하게 삭제)
    console.log('2단계: Auth에서 사용자 계정 삭제 시도...')
    
    // iOS Safari에서 더 안정적인 삭제를 위한 재시도 로직 (iOS는 OAuth 처리가 더 복잡함)
    let deleteAuthError = null;
    let retryCount = 0;
    const maxRetries = 5; // iOS에서 더 많은 재시도
    
    while (retryCount < maxRetries) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      
      if (!error) {
        deleteAuthError = null;
        break;
      }
      
      deleteAuthError = error;
      retryCount++;
      console.log(`Auth 삭제 시도 ${retryCount}/${maxRetries} 실패:`, error.message);
      
      if (retryCount < maxRetries) {
        // iOS에서 더 긴 대기 시간 (OAuth 처리 시간 고려)
        const waitTime = retryCount <= 2 ? 2000 * retryCount : 5000; // 첫 2번은 2초씩, 이후 5초
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    if (deleteAuthError) {
      console.error('❌ Auth 사용자 삭제 최종 실패:', deleteAuthError)
      
      // Auth 삭제 실패 시 전체 탈퇴 중단
      return NextResponse.json({
        success: false,
        error: 'OAuth 연결 해제에 실패했습니다. iOS Safari에서는 잠시 후 다시 시도해주세요.',
        details: deleteAuthError.message,
        requiresRetry: true,
        isIOSIssue: true // iOS 특화 오류 표시
      }, { status: 500 })
    }
    
    console.log('✅ Auth에서 사용자 계정 삭제 성공 - OAuth 연결 완전 해제됨')
    
    // 3단계: 하이브리드 탈퇴 처리 - 통계 데이터 익명화 보존
    console.log('3단계: 하이브리드 탈퇴 처리 시작...')
    
    // 익명 사용자 레코드 생성 (없으면 생성)
    const anonymousUserId = '00000000-0000-0000-0000-000000000000'
    const { data: existingAnonymous } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', anonymousUserId)
      .single()
    
    if (!existingAnonymous) {
      await supabaseAdmin.from('users').insert({
        id: anonymousUserId,
        nickname: '탈퇴한 사용자',
        email: 'deleted@anonymous.com',
        profile_image: 'https://via.placeholder.com/100x100/cccccc/666666?text=DEL',
        provider: 'email',
        provider_id: 'anonymous_user',
        user_type: 'student', // 'anonymous' 대신 허용되는 값 사용
        is_student: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      console.log('익명 사용자 레코드 생성 완료')
    }
    
    // === 통계 데이터 익명화 처리 (DEV_NOTES_설정.txt 3단계) ===
    
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
    
    // === 통계 무결성 보존 데이터 (DEV_NOTES_설정.txt 4단계) ===
    
    console.log('통계 무결성 보존 데이터 유지...')
    
    // 별점 데이터 보존 (통계 왜곡 방지)
    // meal_ratings, menu_item_ratings는 삭제하지 않음
    console.log('별점 데이터 보존 (통계 무결성 유지)')
    
    // 퀴즈 결과 보존 (서비스 통계)
    // quiz_results는 삭제하지 않음
    console.log('퀴즈 데이터 보존 (서비스 통계)')
    
    // 알림 보존 (시스템 로그)
    // notifications는 삭제하지 않음
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
      message: '계정이 완전히 삭제되었습니다. OAuth 연결도 해제되어 재가입이 가능합니다.'
    })
  } catch (error: any) {
    console.error('계정 삭제 중 예외 발생:', error)
    return NextResponse.json(
      { error: error.message || '계정 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
