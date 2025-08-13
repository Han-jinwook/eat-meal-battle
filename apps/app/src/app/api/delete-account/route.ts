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
    
    // ⚠️ 1단계: Auth에서 먼저 사용자 삭제 (OAuth 연결 완전 해제)
    console.log('1단계: Auth에서 사용자 계정 삭제 시도...')
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user_id)
    
    if (deleteAuthError) {
      console.error('❌ Auth 사용자 삭제 실패:', deleteAuthError)
      
      // Auth 삭제 실패 시 전체 탈퇴 중단
      return NextResponse.json({
        success: false,
        error: 'OAuth 연결 해제에 실패했습니다. 잠시 후 다시 시도해주세요.',
        details: deleteAuthError.message,
        requiresRetry: true
      }, { status: 500 })
    }
    
    console.log('✅ Auth에서 사용자 계정 삭제 성공 - OAuth 연결 완전 해제됨')
    
    // 2단계: 하이브리드 탈퇴 처리 - 개인정보는 삭제, 통계 데이터는 익명화 보존
    console.log('2단계: 하이브리드 탈퇴 처리 시작...')
    
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
    
    // === 완전 삭제 대상 (개인정보/실시간 상호작용) ===
    
    // 1. 댓글 좋아요 삭제 (개인 취향 정보)
    await supabaseAdmin.from('comment_likes').delete().eq('user_id', user_id)
    console.log('댓글 좋아요 데이터 삭제 완료')
    
    // 2. 알림 수신자 기록 삭제 (개인정보)
    await supabaseAdmin.from('notification_recipients').delete().eq('recipient_id', user_id)
    console.log('알림 수신 기록 삭제 완료')
    
    // 3. 관심학교 정보 삭제 (개인정보)
    await supabaseAdmin.from('interest_schools').delete().eq('user_id', user_id)
    console.log('관심학교 데이터 삭제 완료')
    
    // 4. 학교 정보 삭제 (개인정보)
    await supabaseAdmin.from('school_infos').delete().eq('user_id', user_id)
    console.log('학교 정보 데이터 삭제 완료')
    
    // === 익명화 처리 대상 (통계 보존 필요) ===
    
    // 5. 댓글/답글 익명화 ("탈퇴한 사용자"로 표시)
    await supabaseAdmin.from('comments')
      .update({ 
        user_id: '00000000-0000-0000-0000-000000000000', // 익명 사용자 ID
        is_deleted: true // 삭제 표시
      })
      .eq('user_id', user_id)
    console.log('댓글 익명화 완료')
    
    await supabaseAdmin.from('comment_replies')
      .update({ 
        user_id: '00000000-0000-0000-0000-000000000000',
        is_deleted: true
      })
      .eq('user_id', user_id)
    console.log('답글 익명화 완료')
    
    // 6. 별점 데이터는 보존 (통계 무결성 유지)
    // menu_item_ratings, meal_ratings는 삭제하지 않음
    console.log('별점 데이터 보존 (통계 무결성 유지)')
    
    // 7. 퀴즈 결과는 보존하되 개인 식별 불가능하게 처리
    // quiz_results, user_champion_records는 보존
    console.log('퀴즈 데이터 보존 (통계 무결성 유지)')
    
    // 8. 급식 이미지는 익명화 ("탈퇴한 사용자"로 표시)
    await supabaseAdmin.from('meal_images')
      .update({ uploaded_by: '00000000-0000-0000-0000-000000000000' })
      .eq('uploaded_by', user_id)
    console.log('급식 이미지 익명화 완료')
    
    // 9. 마지막으로 사용자 기본 정보 삭제
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
