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
    
    console.log('알림 읽음 처리 API 호출:', { 
      userId: session.user.id,
      notificationId 
    });
    
    const now = new Date().toISOString();
    
    // 특정 알림 ID가 제공된 경우
    if (notificationId) {
      // 직접 notification_recipients 테이블에서 읽지 않은 모든 알림을 조회
      const { data: allRecipients, error: recipientQueryError } = await supabase
        .from('notification_recipients')
        .select('*')
        .eq('recipient_id', session.user.id)
        .eq('is_read', false);
      
      console.log('읽지 않은 모든 알림:', allRecipients);
      
      if (recipientQueryError) {
        console.error('알림 조회 오류:', recipientQueryError);
        return NextResponse.json({ error: '알림 조회 중 오류가 발생했습니다.' }, { status: 500 });
      }
      
      // notifications 테이블에서 해당 ID의 알림 조회
      const { data: notification, error: notificationError } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', notificationId)
        .single();
      
      console.log('지정된 ID의 알림 조회 결과:', notification);
      
      if (notificationError && notificationError.code !== 'PGRST116') {
        console.error('알림 조회 오류:', notificationError);
        return NextResponse.json({ error: '알림 조회 중 오류가 발생했습니다.' }, { status: 500 });
      }
      
      // 읽지 않은 알림 중에서 해당 notification_id와 일치하는 레코드를 찾음
      let recipientToUpdate = null;
      
      if (allRecipients && allRecipients.length > 0) {
        // 1. 정확한 notification_id 일치 확인
        recipientToUpdate = allRecipients.find(r => r.notification_id === notificationId);
        
        // 2. 일치하는 것이 없다면, 직접 수신자 ID를 사용하여 업데이트
        if (!recipientToUpdate && notification) {
          // 해당 알림에 대한 수신자 레코드 조회
          const { data: specificRecipient, error: specificError } = await supabase
            .from('notification_recipients')
            .select('*')
            .eq('recipient_id', session.user.id)
            .eq('notification_id', notificationId)
            .eq('is_read', false)
            .single();
          
          console.log('특정 알림의 수신자 조회:', specificRecipient);
          
          if (!specificError) {
            recipientToUpdate = specificRecipient;
          }
        }
      }
      
      console.log('업데이트할 수신자:', recipientToUpdate);
      
      // 수신자 레코드가 있으면 업데이트
      if (recipientToUpdate) {
        const { data: updateResult, error: updateError } = await supabase
          .from('notification_recipients')
          .update({
            is_read: true,
            read_at: now
          })
          .eq('id', recipientToUpdate.id)
          .select();
        
        console.log('알림 업데이트 결과:', updateResult, '오류:', updateError);
        
        if (updateError) {
          console.error('알림 업데이트 오류:', updateError);
          return NextResponse.json({ error: '알림 업데이트 중 오류가 발생했습니다.' }, { status: 500 });
        }
        
        return NextResponse.json({
          success: true,
          message: '알림이 읽음 처리되었습니다.',
          updatedRecipient: updateResult
        });
      } else {
        // 수신자 레코드가 없는 경우, 새로 생성
        console.log('수신자 레코드가 없어 새로 생성 시도');
        
        // 알림이 존재하는지 확인
        if (notification) {
          const { data: newRecipient, error: createError } = await supabase
            .from('notification_recipients')
            .upsert({
              recipient_id: session.user.id,
              notification_id: notificationId,
              is_read: true,
              read_at: now
            })
            .select();
          
          console.log('새 수신자 레코드 생성:', newRecipient, '오류:', createError);
          
          if (createError) {
            console.error('수신자 레코드 생성 오류:', createError);
            return NextResponse.json({ error: '수신자 레코드 생성 중 오류가 발생했습니다.' }, { status: 500 });
          }
          
          return NextResponse.json({
            success: true,
            message: '알림이 읽음 처리되었습니다.',
            newRecipient
          });
        } else {
          return NextResponse.json({
            success: false,
            message: '해당 알림을 찾을 수 없습니다.',
          });
        }
      }
    } else {
      // 모든 알림 읽음 처리
      const { data, error, count } = await supabase
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
    
    // 이 코드는 더 이상 사용되지 않습니다. 위에서 각 경우에 맞게 응답을 반환합니다.
  } catch (error) {
    console.error('알림 읽음 처리 API 오류:', error);
    return NextResponse.json(
      { error: `알림 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}` },
      { status: 500 }
    );
  }
}