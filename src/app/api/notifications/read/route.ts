import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabaseAdmin';

/**
 * 알림을 읽음 처리하는 API
 * 
 * Body Parameters:
 * - notificationId?: string (특정 알림 ID, 없으면 모든 알림 읽음 처리)
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const supabaseAdmin = createAdminClient();
  
  try {
    // 사용자 인증 확인
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    
    // 요청 파라미터 추출
    const { notificationId } = await request.json();
    
    console.log('알림 읽음 처리 API 호출:', { 
      userId: session.user.id,
      notificationId 
    });
    
    const now = new Date().toISOString();
    
    // 특정 알림 ID가 제공된 경우
    if (notificationId) {
      // 관리자 권한으로 직접 업데이트 시도
      const { data: updateResult, error: updateError } = await supabaseAdmin
        .from('notification_recipients')
        .update({
          is_read: true,
          read_at: now
        })
        .eq('recipient_id', session.user.id)
        .eq('notification_id', notificationId);
      
      console.log('알림 업데이트 결과:', updateResult, '오류:', updateError);
      
      if (updateError) {
        console.error('알림 업데이트 오류:', updateError);
        
        // ID가 다른 형식일 수 있으므로 notifications 테이블에서 해당 ID 조회
        const { data: notification } = await supabaseAdmin
          .from('notifications')
          .select('id')
          .eq('id', notificationId)
          .single();
        
        if (notification) {
          // notification_recipients에서 해당 알림의 수신자 레코드 찾기
          const { data: recipients } = await supabaseAdmin
            .from('notification_recipients')
            .select('id')
            .eq('recipient_id', session.user.id)
            .eq('notification_id', notification.id)
            .eq('is_read', false);
          
          if (recipients && recipients.length > 0) {
            // 찾은 수신자 레코드 업데이트
            const { data: finalResult, error: finalError } = await supabaseAdmin
              .from('notification_recipients')
              .update({
                is_read: true,
                read_at: now
              })
              .eq('id', recipients[0].id);
            
            if (finalError) {
              return NextResponse.json({ error: '알림 상태 업데이트 중 오류가 발생했습니다.' }, { status: 500 });
            }
            
            return NextResponse.json({
              success: true,
              message: '알림이 읽음 처리되었습니다.'
            });
          }
        }
        
        return NextResponse.json({ error: '해당 알림을 찾을 수 없습니다.' }, { status: 404 });
      }
      
      return NextResponse.json({
        success: true,
        message: '알림이 읽음 처리되었습니다.'
      });
    } else {
      // 모든 알림 읽음 처리
      const { data, error, count } = await supabaseAdmin
        .from('notification_recipients')
        .update({
          is_read: true,
          read_at: now
        })
        .eq('recipient_id', session.user.id)
        .eq('is_read', false);
      
      console.log('모든 알림 읽음 처리 결과:', { data, error, count });
      
      if (error) {
        console.error('모든 알림 읽음 처리 오류:', error);
        return NextResponse.json({ error: '알림 상태 업데이트 중 오류가 발생했습니다.' }, { status: 500 });
      }
      
      return NextResponse.json({
        success: true,
        message: '모든 알림이 읽음 처리되었습니다.',
        count: count || 0
      });
    }
  } catch (error) {
    console.error('알림 읽음 처리 API 오류:', error);
    return NextResponse.json(
      { error: `알림 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}` },
      { status: 500 }
    );
  }
}
