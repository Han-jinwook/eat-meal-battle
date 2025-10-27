const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화 (서비스 키 사용)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase 환경변수가 설정되지 않았습니다.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// 관리자 확인 함수
async function isAdmin(context) {
  // Netlify Identity를 사용하는 경우
  const { user } = context.clientContext;
  if (user && user.app_metadata && user.app_metadata.roles.includes('admin')) {
    return true;
  }
  
  // JWT를 직접 확인하는 경우 (예: Supabase)
  if (context.clientContext.headers.authorization) {
    const token = context.clientContext.headers.authorization.split(' ')[1];
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) return false;

    // 'users' 테이블에서 관리자 여부 확인 (예시)
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', user.id)
      .eq('is_admin', true) // is_admin과 같은 컬럼이 있다고 가정
      .single();

    return !!adminUser;
  }
  
  return false;
}

exports.handler = async (event, context) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*', // 실제 프로덕션에서는 특정 도메인으로 제한
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
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
    const { userId } = JSON.parse(event.body);

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '사용자 ID가 필요합니다.' }),
      };
    }

    // 특정 사용자에 대한 세션 생성 (JWT 발급)
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: (await supabaseAdmin.auth.admin.getUserById(userId)).data.user.email,
    });

    if (error) {
      console.error('세션 생성 오류:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: '사용자 세션 생성에 실패했습니다.' }),
      };
    }

    // 실제로는 magic link에서 토큰을 추출해야 하지만, 
    // 클라이언트에서 처리하기 쉽도록 access_token을 직접 찾아 반환
    const accessToken = data.properties.action_link.split('#')[1].split('&').find(s => s.startsWith('access_token=')).split('=')[1];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        message: '세션이 성공적으로 생성되었습니다.',
        access_token: accessToken,
        user_id: userId
      }),
    };

  } catch (error) {
    console.error('핸들러 오류:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '요청 처리 중 오류가 발생했습니다.' }),
    };
  }
};
