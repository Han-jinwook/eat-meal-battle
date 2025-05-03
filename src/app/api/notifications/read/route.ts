import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

/**
 * 알림을 읽음 처리하는 API
 * 
 * Body Parameters:
 * - notificationId?: string (특정 알림 ID, 없으면 모든 알림 읽음 처리)
 */
export async function POST(request: Request) {
  const supabase = createClient();
  
  try {
    // 사용자 인증 확인
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    
    // 요청 파라미터 추출
    const { notificationId } = await request.json();
    
    const now = new Date().toISOString();
    
    let query = supabase
      .from('notification_recipients')
      .update({
        is_read: true,
        read_at: now
      })
      .eq('recipient_id', session.user.id)
      .eq('is_read', false);
    
    // 특정 알림 ID가 제공된 경우
    if (notificationId) {
      query = query.eq('notification_id', notificationId);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('알림 읽음 처리 오류:', error);
      return NextResponse.json({ error: '알림 상태 업데이트 중 오류가 발생했습니다.' }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: notificationId
        ? '알림이 읽음 처리되었습니다.'
        : '모든 알림이 읽음 처리되었습니다.',
      count: count || 0
    });
  } catch (error) {
    console.error('알림 읽음 처리 API 오류:', error);
    return NextResponse.json(
      { error: `알림 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}` },
      { status: 500 }
    );
  }
}