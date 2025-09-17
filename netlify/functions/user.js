const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  // 환경 변수에서 Supabase URL과 서비스 키를 가져옵니다.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  // 디버깅을 위한 환경변수 로깅
  console.log('🔍 환경변수 확인:', {
    supabaseUrl: supabaseUrl ? '설정됨' : '없음',
    supabaseKey: supabaseKey ? '설정됨' : '없음',
    allEnvKeys: Object.keys(process.env).filter(key => key.includes('SUPABASE'))
  });

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase 환경변수 누락:', {
      supabaseUrl: !!supabaseUrl,
      supabaseKey: !!supabaseKey,
      availableEnvs: Object.keys(process.env).filter(key => key.includes('SUPABASE'))
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Supabase 환경 변수가 설정되지 않았습니다.',
        debug: {
          supabaseUrl: !!supabaseUrl,
          supabaseKey: !!supabaseKey,
          availableEnvs: Object.keys(process.env).filter(key => key.includes('SUPABASE'))
        }
      }),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { action, userId, nickname } = JSON.parse(event.body);

  // 닉네임 업데이트 액션 처리
  if (action === 'update-nickname') {
    if (!userId || !nickname) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '사용자 ID와 닉네임이 필요합니다.' }),
      };
    }

    try {
      // users 테이블에서 닉네임 업데이트
      const { data, error } = await supabase
        .from('users')
        .update({ nickname: nickname })
        .eq('id', userId)
        .select();

      if (error) {
        console.error('Supabase 닉네임 업데이트 오류:', error);
        throw error;
      }

      // auth.users 테이블에서도 닉네임(user_metadata) 업데이트
      const { error: authError } = await supabase.auth.admin.updateUserById(
        userId,
        { user_metadata: { name: nickname } }
      );

      if (authError) {
        console.error('Supabase Auth 사용자 메타데이터 업데이트 오류:', authError);
        // 이 오류는 치명적이지 않을 수 있으므로, 로깅만 하고 계속 진행합니다.
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ message: '닉네임이 성공적으로 업데이트되었습니다.', data }),
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message || '서버 내부 오류' }),
      };
    }
  }

  return {
    statusCode: 400,
    body: JSON.stringify({ error: '알 수 없는 액션입니다.' }),
  };
};
