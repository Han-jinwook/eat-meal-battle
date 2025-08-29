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
  'Content-Type': 'application/json',
};

exports.handler = async (event, context) => {
  // CORS preflight 요청 처리
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
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // 요청 데이터 파싱
    const { imageId, reporterId } = JSON.parse(event.body);

    if (!imageId || !reporterId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '필수 데이터가 누락되었습니다.' }),
      };
    }

    // 기존 신고 확인
    const { data: existingReport, error } = await supabaseAdmin
      .from('meal_image_reports')
      .select('id')
      .eq('image_id', imageId)
      .eq('reporter_id', reporterId)
      .maybeSingle();

    if (error) {
      console.error('기존 신고 확인 오류:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: '신고 확인 중 오류가 발생했습니다.' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        hasReport: !!existingReport,
        reportId: existingReport?.id || null
      }),
    };

  } catch (error) {
    console.error('API 오류:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '서버 오류가 발생했습니다.' }),
    };
  }
};
