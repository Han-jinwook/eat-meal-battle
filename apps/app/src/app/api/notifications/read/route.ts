import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabaseAdmin';

// 디버깅 상수
const DEBUG_MODE = false; // 프로덕션에서는 로그 비활성화
const log = (...args: any[]) => {
  if (DEBUG_MODE) {
    console.log('[API Logs]', ...args);
  }
};

/**
 * 알림을 읽음 처리하는 API
 * 
 * Body Parameters:
 * - notificationId?: string (특정 알림 ID, 없으면 모든 알림 읽음 처리)
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const supabaseAdmin = createAdminClient();
  
  // ------------------------------------------------------------
  // 사용자 식별: Authorization 헤더의 JWT 우선, 없으면 세션 쿠키
  // ------------------------------------------------------------
  const authHeader = request.headers.get('Authorization');
  let userId: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: tokenErr } = await supabase.auth.getUser(token);
    if (tokenErr) {
      log('토큰 기반 사용자 조회 오류:', tokenErr);
    }
    userId = user?.id ?? null;
  }
  // 쿠키 기반(Next.js helper) 세션도 시도 (fallback)
  if (!userId) {
    const { data: { session } } = await supabase.auth.getSession();
    userId = session?.user?.id ?? null;
  }

  if (!userId) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }
  
  try {
    // 요청 파라미터 추출
    const { notificationId } = await request.json();
    
    log('알림 읽음 처리 API 호출:', { 
      userId,
      notificationId,
      requestTime: new Date().toISOString() 
    });
    
    const now = new Date().toISOString();
    
    // 특정 알림 ID가 제공된 경우
    if (notificationId) {
      // 직접 업데이트 - notification_recipients 테이블의 id로 직접 업데이트
      log('수신자 레코드 ID로 직접 업데이트 시도:', notificationId);
      
      const { data: updateResult, error: updateError } = await supabaseAdmin
        .from('notification_recipients')
        .update({
          is_read: true,
          read_at: now
        })
        .eq('notification_id', notificationId)
        .eq('recipient_id', userId)
        .select();
      
      log('업데이트 결과:', updateResult, '오류:', updateError);
      
      // 특정 ID로 업데이트 실패 시 - SQL 문을 확인하고 실패 원인 파악
      if (updateError) {
        log('알림 업데이트 오류 발생! 디버깅 정보:', {
          error: updateError,
          query: `UPDATE notification_recipients SET is_read = true, read_at = '${now}' WHERE notification_id = '${notificationId}' AND recipient_id = '${userId}'`
        });
        
        // 바로 실패 응답
        return NextResponse.json({ 
          error: '알림 업데이트 실패', 
          details: updateError 
        }, { status: 500 });
      }
      
      // 성공 응답
      return NextResponse.json({
        success: true,
        message: '알림이 읽음 처리되었습니다.',
        updated: updateResult
      });
    } else {
      // 모든 알림 읽음 처리
      log('사용자의 모든 알림 읽음 처리 시도:', userId);
      
      const { data, error, count } = await supabaseAdmin
        .from('notification_recipients')
        .update({
          is_read: true,
          read_at: now
        })
        .eq('recipient_id', userId)
        .eq('is_read', false);
      
      log('모든 알림 읽음 처리 결과:', { count, error });
      
      if (error) {
        log('모든 알림 읽음 처리 오류:', error);
        return NextResponse.json({ error: '알림 상태 업데이트 중 오류가 발생했습니다.' }, { status: 500 });
      }
      
      return NextResponse.json({
        success: true,
        message: '모든 알림이 읽음 처리되었습니다.',
        count: count || 0
      });
    }
  } catch (error) {
    log('알림 읽음 처리 API 오류:', error);
    return NextResponse.json(
      { error: `알림 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}` },
      { status: 500 }
    );
  }
}
