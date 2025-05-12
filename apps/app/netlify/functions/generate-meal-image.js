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
    
    // 메뉴 항목 구조화
    console.log(`[generate-meal-image] 전체 메뉴 항목:`, menu_items);
    
    // 메뉴 항목 분류
    const riceMenu = menu_items.find(item => 
      item.includes('쌀') || item.includes('밥') || item.includes('보리') || item.includes('환경') || item.includes('친환경')
    ) || '';
    
    const soupMenu = menu_items.find(item => 
      item.includes('국') || item.includes('탕') || item.includes('찜') || item.includes('찌개')
    ) || '';
    
    // 나머지 메뉴는 반찬으로 간주
    const sideMenus = menu_items.filter(item => 
      item !== riceMenu && item !== soupMenu
    );
    
    // 각 항목을 문자열로 변환
    const menuString = menu_items.join(', ');
    console.log(`[generate-meal-image] 메뉴 문자열: ${menuString}`);
    console.log(`[generate-meal-image] 밥 메뉴: ${riceMenu}`);
    console.log(`[generate-meal-image] 국/집 메뉴: ${soupMenu}`);
    console.log(`[generate-meal-image] 반찬 메뉴:`, sideMenus);
    
    // 구조화된 메뉴 문자열 생성
    const structuredMenuString = `
    * 밥/메인: ${riceMenu || '없음'}
    * 국/집요리: ${soupMenu || '없음'}
    * 반찬: ${sideMenus.join(', ') || '없음'}`;
    
    console.log(`[generate-meal-image] 구조화된 메뉴 정보: ${structuredMenuString}`);
    console.log('[generate-meal-image] GPT-4o 이미지 생성 모델에 한국어 메뉴 전달 예정');
    
    // GPT-4o 이미지 생성 모델로 이미지 생성
    console.log('[generate-meal-image] OpenAI API 호출 중...');
    // OpenAI 이미지 생성 API 호출
    console.log('[generate-meal-image] 이미지 생성 API 호출 시도');
    
    // images.generate API를 사용하여 이미지 생성
    const imageResponse = await openai.images.generate({
      model: "gpt-image-1", // GPT-4o의 이미지 생성 모델 사용 (품질 및 정확도 향상)
      prompt: `한국 학교 급식 - 6칸 스테인리스 식판에 실제처럼 촬영한 사진. 포토리얼리스틱 품질.${structuredMenuString}

배치: 하단왼쪽 칸(사각형)=${riceMenu || '밥'}, 하단오른쪽 칸(원형)=${soupMenu || '국'}, 상단 4개 칸=반찬(${sideMenus.join(', ')}).

반찬이 4개 미만이면 다른 한국식 반찬 추가. 반찬이 4개 초과는 중요한 것만 선택. 탑다운 구도, 실제 생생한 표현.`,
      n: 1,
      size: "1536x1024", // 식판은 가로가 더 길기 때문에 가로형 이미지 사용
      quality: "low"     // 데이터 가볍고 처리 속도 빠름(low, medium, high 중 선택)
      // GPT-4o는 response_format 파라미터를 지원하지 않음
    });
    
    console.log('[generate-meal-image] 이미지 생성 API 호출 성공');
    
    // 이미지 데이터 추출
    if (!imageResponse || !imageResponse.data || imageResponse.data.length === 0) {
      throw new Error('이미지 생성에 실패했습니다. 응답이 비어있습니다.');
    }
    
    // 이미지 데이터 처리 
    console.log(`[generate-meal-image] 이미지 생성 완료, 응답 처리 중...`);
    
    const item = imageResponse.data[0];
    let imageData;
    
    // URL 또는 b64_json 여부 확인
    if (item.url) {
      // URL이 있는 경우 다운로드 후 처리
      console.log(`[generate-meal-image] URL 형식의 이미지 데이터 받음`);
      console.log('[generate-meal-image] 이미지 다운로드 중...');
      const imageRes = await fetch(item.url);
      const imageBuffer = await imageRes.arrayBuffer();
      imageData = Buffer.from(imageBuffer).toString('base64');
    } else if (item.b64_json) {
      // Base64 데이터가 바로 있는 경우
      console.log('[generate-meal-image] b64_json 형식의 이미지 데이터 받음');
      imageData = item.b64_json;
    } else {
      throw new Error('이미지 데이터가 없습니다.');
    }
    
    console.log(`[generate-meal-image] 이미지 데이터 길이=${imageData.length}`);
    const base64Image = imageData; // 사용하는 변수명 유지
    
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
