// AI 이미지 생성 함수
// OpenAI API를 사용하여 급식 메뉴에 맞는 이미지 생성

const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');

// dotenv 사용 - 로컬 개발 환경용
try {
  require('dotenv').config();
} catch (e) {
  console.log('dotenv 모듈을 로드할 수 없습니다. Netlify 환경에서는 정상입니다.');
}

exports.handler = async (event) => {
  console.log('[generate-meal-image] 함수 시작');
  
  try {
    // 요청 데이터 파싱
    const { menu_items, meal_id, school_code, meal_date, meal_type, user_id } = JSON.parse(event.body);
    
    if (!menu_items || !meal_id) {
      throw new Error('필수 매개변수가 누락되었습니다 (menu_items, meal_id)');
    }
    
    console.log(`[generate-meal-image] 급식 ID: ${meal_id}, 메뉴 항목 수: ${menu_items.length}`);
    
    // OpenAI 클라이언트 초기화
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.');
    }
    
    // Supabase 클라이언트 초기화
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase 환경 변수가 올바르게 설정되지 않았습니다.');
    }
    
    // 메뉴 항목을 문자열로 변환
    const menuString = menu_items.join(', ');
    console.log(`[generate-meal-image] 메뉴 문자열: ${menuString}`);
    
    // DALL-E 3으로 이미지 생성
    console.log('[generate-meal-image] OpenAI API 호출 중...');
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: `A detailed, appetizing photo of a Korean school lunch served on a traditional stainless steel compartment tray containing: ${menuString}.

Specific tray structure: The tray has 6 compartments - 4 small rectangular compartments on the top row for side dishes, a wide shallow rectangular compartment on the bottom left for rice/main dish, and a deep circular bowl-shaped compartment on the bottom right for soup.

Style requirements: Soft metallic sheen on the stainless steel tray, evenly diffused lighting, solid neutral background, photorealistic style. Capture from a top-down view to clearly show all food items in their designated compartments.

Make sure the food appears authentic to Korean school lunch cuisine with proper portion sizes and traditional presentation.`,
      n: 1,
      size: "1024x1024",
    });
    
    if (!imageResponse.data || imageResponse.data.length === 0) {
      throw new Error('이미지 생성에 실패했습니다.');
    }
    
    const imageUrl = imageResponse.data[0].url;
    console.log(`[generate-meal-image] 이미지 생성 완료: ${imageUrl.substring(0, 30)}...`);
    
    // 이미지 다운로드
    console.log('[generate-meal-image] 이미지 다운로드 중...');
    const imageRes = await fetch(imageUrl);
    const imageBuffer = await imageRes.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    
    // 파일명 생성
    const fileName = `ai_generated_${meal_id}_${Date.now()}.png`;
    
    // 이미지를 Supabase Storage에 업로드
    console.log(`[generate-meal-image] Supabase Storage에 업로드 중: ${fileName}`);
    const { data: fileData, error: uploadError } = await supabase.storage
      .from('meal-images')
      .upload(fileName, Buffer.from(base64Image, 'base64'), {
        contentType: 'image/png',
        upsert: true
      });
      
    if (uploadError) {
      console.error('[generate-meal-image] 이미지 업로드 오류:', uploadError);
      throw uploadError;
    }
    
    // 이미지 URL 가져오기
    const { data: urlData } = supabase.storage
      .from('meal-images')
      .getPublicUrl(fileName);
      
    const publicUrl = urlData.publicUrl;
    console.log(`[generate-meal-image] 공개 URL 생성: ${publicUrl.substring(0, 30)}...`);
    
    // 클라이언트에서 보낸 user_id 사용
    console.log('[generate-meal-image] 사용자 ID 확인:', { user_id });
    
    // 요청에서 받은 user_id 사용
    const userId = user_id;
    
    // DB에 이미지 정보 저장 (단순화된 버전)
    console.log('[generate-meal-image] 이미지 정보 DB에 저장 중...');
    console.log(`[generate-meal-image] 저장할 데이터:`, { meal_id });
    
    // meal_images 테이블 구조에 맞게 이미지 정보 저장
    // status와 is_shared를 적절히 설정하면 트리거로 자동 알림 발송
    const { data: imageRecord, error: dbError } = await supabase
      .from('meal_images')
      .insert({
        meal_id: meal_id,
        image_url: publicUrl,
        uploaded_by: userId,
        status: 'approved',    // 중요: AI 이미지는 자동 승인
        is_shared: true,       // 중요: 공유 활성화 설정
        match_score: 100,      // 100% 일치 (최대값으로 설정)
        source: 'ai',          // 이미지 출처 표시
        explanation: 'AI가 생성한 급식 이미지입니다.'
      })
      .select()
      .single();
      
    if (dbError) {
      console.error('[generate-meal-image] DB 저장 오류:', dbError);
      throw dbError;
    }
    
    console.log(`[generate-meal-image] 성공: 이미지 ID ${imageRecord.id}`);
    
    // 중요: 알림 관련 로직 제거
    // meal_images 테이블에 이미지 정보가 저장되면 트리거로 자동 알림 발송
    // status와 is_shared 값이 적절히 설정되어 있으므로 추가 작업 필요 없음
    console.log('[generate-meal-image] 이미지 저장 완료 - 자동 트리거로 알림 처리 예상');
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        image: imageRecord
      })
    };
  } catch (error) {
    console.error('[generate-meal-image] 오류:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: error.message || '서버 오류가 발생했습니다'
      })
    };
  }
};
