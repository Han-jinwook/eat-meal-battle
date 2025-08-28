const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // POST 요청만 허용
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // 요청 데이터 파싱
    const { 
      imageId, 
      imageUrl, 
      reporterId, 
      schoolCode, 
      mealDate, 
      mealType, 
      uploaderNickname,
      reportReason = '등록오류'
    } = JSON.parse(event.body);

    console.log('신고 데이터 수신:', {
      imageId,
      reporterId,
      schoolCode,
      mealDate,
      mealType,
      uploaderNickname,
      reportReason
    });

    // 필수 데이터 검증
    if (!imageId || !reporterId || !schoolCode || !mealDate || !mealType || !imageUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: '필수 데이터가 누락되었습니다.',
          required: ['imageId', 'reporterId', 'schoolCode', 'mealDate', 'mealType', 'imageUrl']
        }),
      };
    }

    // 사용자 인증 확인 (Authorization 헤더에서 JWT 토큰 추출)
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: '인증이 필요합니다.' }),
      };
    }

    const token = authHeader.split(' ')[1];
    
    // JWT 토큰으로 사용자 확인
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user || user.id !== reporterId) {
      console.error('인증 오류:', authError);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: '유효하지 않은 인증 정보입니다.' }),
      };
    }

    // 이미지 존재 여부 확인
    const { data: imageData, error: imageError } = await supabaseAdmin
      .from('meal_images')
      .select('id, status, uploaded_by')
      .eq('id', imageId)
      .single();

    if (imageError || !imageData) {
      console.error('이미지 조회 오류:', imageError);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: '해당 이미지를 찾을 수 없습니다.' }),
      };
    }

    // 승인된 이미지만 신고 가능
    if (imageData.status !== 'approved') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '승인된 이미지만 신고할 수 있습니다.' }),
      };
    }

    // 중복 신고 확인 (같은 사용자가 같은 이미지를 이미 신고했는지)
    const { data: existingReport, error: duplicateError } = await supabaseAdmin
      .from('meal_image_reports')
      .select('id')
      .eq('image_id', imageId)
      .eq('reporter_id', reporterId)
      .single();

    if (existingReport) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: '이미 신고한 이미지입니다.' }),
      };
    }

    // 신고 데이터 저장
    const { data: reportData, error: insertError } = await supabaseAdmin
      .from('meal_image_reports')
      .insert({
        image_id: imageId,
        reporter_id: reporterId,
        school_code: schoolCode,
        meal_date: mealDate,
        meal_type: mealType,
        image_url: imageUrl,
        uploader_nickname: uploaderNickname,
        report_reason: reportReason,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('신고 저장 오류:', insertError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: '신고 저장 중 오류가 발생했습니다.' }),
      };
    }

    console.log('신고 저장 성공:', reportData.id);

    // 성공 응답
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: '신고가 접수되었습니다.',
        reportId: reportData.id
      }),
    };

  } catch (error) {
    console.error('신고 처리 중 오류:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: '서버 오류가 발생했습니다.',
        details: error.message 
      }),
    };
  }
};
