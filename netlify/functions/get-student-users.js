const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화 (서비스 키 사용)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase 환경변수가 설정되지 않았습니다.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*', // 실제 프로덕션에서는 특정 도메인으로 제한
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  const authorization = event.headers.authorization;
  if (!authorization) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: '인증 정보가 없습니다.' }),
    };
  }

  try {
    const token = authorization.split(' ')[1];
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error('유효하지 않은 토큰입니다.');
    }

    // users 테이블에서 is_admin 플래그 확인
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (adminError || !adminUser || !adminUser.is_admin) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: '관리자 권한이 없습니다.' }),
      };
    }
  } catch (error) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: error.message || '인증 처리 중 오류가 발생했습니다.' }),
    };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, nickname, email')
      .eq('is_student', true)
      .order('nickname', { ascending: true });

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ users: data }),
    };

  } catch (error) {
    console.error('학생 계정 목록 조회 오류:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '서버에서 학생 목록을 가져오는 데 실패했습니다.' }),
    };
  }
};
