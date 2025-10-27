const { createClient } = require('@supabase/supabase-js');

// Supabase Admin 클라이언트 초기화
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

exports.handler = async (event) => {
  // CORS 헤더
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // OPTIONS 요청 처리
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // POST 요청만 허용
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { userId } = JSON.parse(event.body);

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'userId가 필요합니다.' })
      };
    }

    console.log('🔐 staff-login: userId로 세션 생성 시작:', userId);

    // 1. users 테이블에서 이메일 조회
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('❌ 사용자 조회 실패:', userError);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: '사용자를 찾을 수 없습니다.' })
      };
    }

    console.log('✅ 사용자 이메일 조회 성공:', user.email);

    // 2. Supabase Admin으로 해당 이메일의 세션 토큰 생성
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email
    });

    if (error) {
      console.error('❌ 세션 토큰 생성 실패:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message || '세션 생성에 실패했습니다.' })
      };
    }

    console.log('✅ 세션 토큰 생성 성공');

    // 3. 생성된 토큰 반환
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        access_token: data.properties.hashed_token,
        refresh_token: data.properties.hashed_token
      })
    };

  } catch (error) {
    console.error('❌ staff-login 오류:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message || '서버 오류가 발생했습니다.' 
      })
    };
  }
};
