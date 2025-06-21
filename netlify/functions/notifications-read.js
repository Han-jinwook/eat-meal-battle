const { createClient } = require('@supabase/supabase-js');

// Supabase Admin 클라이언트 생성 함수
const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase URL 또는 서비스 롤 키가 설정되지 않았습니다.');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

// 디버깅 유틸리티 (최소화됨)
const log = process.env.NODE_ENV === 'development' 
  ? (...args) => console.log('[Function Logs]', ...args)
  : () => {};

/**
 * 알림을 읽음 처리하는 Netlify 서버리스 함수
 */
exports.handler = async (event, context) => {
  // POST 메서드 검증
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }
  
  // Supabase Admin 클라이언트 생성
  const supabaseAdmin = createAdminClient();
  
  // 사용자 인증 처리
  const authHeader = event.headers.authorization;
  let userId = null;
  
  try {
    // Bearer 토큰이 제공된 경우
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user }, error: tokenErr } = await supabaseAdmin.auth.getUser(token);
      
      if (tokenErr) {
        log('토큰 기반 사용자 조회 오류:', tokenErr);
      }
      
      userId = user?.id ?? null;
    }
    
    // 인증 실패 시 에러 응답
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: '인증이 필요합니다.' })
      };
    }
    
    // 요청 본문 파싱
    const requestBody = JSON.parse(event.body || '{}');
    const { notificationId } = requestBody;
    
    log('알림 읽음 처리 함수 호출:', { userId, notificationId });
    
    // 현재 시간
    const now = new Date().toISOString();
    
    // 특정 알림 ID가 제공된 경우
    if (notificationId) {
      // notification_id와 recipient_id로 업데이트
      const { data: updateResult, error: updateError } = await supabaseAdmin
        .from('notification_recipients')
        .update({
          is_read: true,
          read_at: now
        })
        .eq('notification_id', notificationId)
        .eq('recipient_id', userId)
        .select();
      
      // 업데이트 실패 시
      if (updateError) {
        log('알림 업데이트 실패:', updateError);
        return {
          statusCode: 500,
          body: JSON.stringify({ 
            error: '알림 업데이트 실패', 
            details: updateError 
          })
        };
      }
      
      // 성공 응답
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: '알림이 읽음 처리되었습니다.',
          updated: updateResult
        })
      };
    } else {
      // 모든 알림 읽음 처리
      const { data, error, count } = await supabaseAdmin
        .from('notification_recipients')
        .update({
          is_read: true,
          read_at: now
        })
        .eq('recipient_id', userId)
        .eq('is_read', false)
        .select();
        
      if (error) {
        log('모든 알림 업데이트 실패:', error);
        return {
          statusCode: 500,
          body: JSON.stringify({ 
            error: '모든 알림 업데이트 실패', 
            details: error 
          })
        };
      }
      
      // 성공 응답
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: '모든 알림이 읽음 처리되었습니다.',
          updated: data,
          count: (data || []).length
        })
      };
    }
  } catch (error) {
    log('알림 읽음 처리 함수 오류:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: `알림 처리 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}` 
      })
    };
  }
};
