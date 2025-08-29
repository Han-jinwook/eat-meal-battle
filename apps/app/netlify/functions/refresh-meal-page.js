const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
  // CORS preflight 요청 처리
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'POST 메소드만 허용됩니다.' })
    };
  }

  try {
    const { school_code, meal_date, meal_type } = JSON.parse(event.body);

    if (!school_code || !meal_date || !meal_type) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: '필수 데이터가 누락되었습니다.',
          required: ['school_code', 'meal_date', 'meal_type']
        })
      };
    }

    // 해당 급식에 대한 모든 활성 사용자 세션에 실시간 업데이트 신호 전송
    // Supabase Realtime을 통해 meal_images 테이블 변경 알림
    const { error: broadcastError } = await supabaseAdmin
      .channel(`meal_${school_code}_${meal_date}_${meal_type}`)
      .send({
        type: 'broadcast',
        event: 'meal_image_deleted',
        payload: {
          school_code,
          meal_date,
          meal_type,
          timestamp: new Date().toISOString()
        }
      });

    if (broadcastError) {
      console.error('실시간 업데이트 전송 오류:', broadcastError);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        message: '급식페이지 새로고침 신호가 전송되었습니다.',
        meal_info: {
          school_code,
          meal_date,
          meal_type
        }
      })
    };

  } catch (error) {
    console.error('급식페이지 새로고침 오류:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '서버 오류가 발생했습니다.' })
    };
  }
};
