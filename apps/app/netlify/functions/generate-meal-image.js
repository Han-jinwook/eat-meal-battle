// AI 이미지 생성 함수
// OpenAI API를 사용하여 급식 메뉴에 맞는 이미지 생성

const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');
const sharp = require('sharp');

// dotenv 사용 - 로컬 개발 환경용
try {
  require('dotenv').config();
} catch (e) {
  console.log('dotenv 모듈을 로드할 수 없습니다. Netlify 환경에서는 정상입니다.');
}

exports.handler = async (event, context) => {
  // Netlify Pro 플랜 26초 한계에 맞춰 타임아웃 설정
  context.callbackWaitsForEmptyEventLoop = false;
  const startTime = Date.now();
  console.log('[generate-meal-image] 함수 시작');
  
  try {
    // 인증 토큰 확인
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          error: '인증 토큰이 필요합니다.'
        })
      };
    }
    
    const token = authHeader.replace('Bearer ', '');
    console.log('[generate-meal-image] 사용자 토큰으로 인증');
    
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
    
    // Supabase 클라이언트 초기화 (사용자 토큰 사용 - 인증용)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, // ✅ Service Role → Anon Key 변경
      {
        auth: {
          persistSession: false
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}` // ✅ 사용자 토큰 사용
          }
        }
      }
    );
    
    // Service Role 클라이언트 (Storage 업로드 및 DB 저장용)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY // Service Role Key 사용
    );
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
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
    // OpenAI 이미지 생성 API 호출 (Pro 플랜 26초 한계 고려)
    console.log('[generate-meal-image] 이미지 생성 API 호출 시도');
    
    // 타임아웃 래퍼 함수 - Pro 플랜 26초 한계에 맞춰 22초로 설정
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('OpenAI API 호출 타임아웃 (22초 초과)')), 22000);
    });
    
    // images.generate API를 사용하여 이미지 생성
    const imageGenerationPromise = openai.images.generate({
      model: "gpt-image-1",
      prompt: `한국 학교 급식 스테인리스 식판 - 정확히 6개 칸만 있는 구조${structuredMenuString}

      절대 규칙 (무조건 지켜야 함):
      1. 정확히 6칸만 존재 (5칸 아님, 7칸 아님, 오직 6칸)
      2. 하단 2칸: 왼쪽(사각형/밥), 오른쪽(원형/국)
      3. 상단 4칸: 작은 사각형들 (반찬용)
      4. 식판 전체가 프레임 안에 완전히 들어와야 함 (테두리 잘림 금지)
      5. 위에서 내려다보는 탑다운 뷰

      메뉴 배치:
      - 하단왼쪽(밥): ${riceMenu || (menu_items[0] || '밥')}
      - 하단오른쪽(국): ${soupMenu || (menu_items[1] || '국')}  
      - 상단 4칸(반찬): ${sideMenus.length > 0 ? sideMenus.slice(0, 4).join(', ') : '김치, 나물, 단무지, 미역국'}

      스타일: 실제 한국 학교 급식실 느낌, 자연광, 포토리얼리스틱`,
      n: 1,
      size: "1024x1024",   // OpenAI API 지원 크기 (512x512 더이상 지원 안함)
      quality: "medium"    // medium 품질로 설정하여 속도 최적화
      // gpt-image-1 모델은 response_format, style 파라미터를 지원하지 않음
    });
    
    // 타임아웃과 이미지 생성 중 먼저 완료되는 것을 기다림
    const imageResponse = await Promise.race([imageGenerationPromise, timeoutPromise]);
    
    const apiCallTime = Date.now() - startTime;
    console.log(`[generate-meal-image] 이미지 생성 API 호출 성공 (소요시간: ${apiCallTime}ms)`);
    
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
    
    // PNG → JPEG 압축 변환 (Sharp 사용)
    console.log('[generate-meal-image] PNG → JPEG 압축 변환 중...');
    const pngBuffer = Buffer.from(imageData, 'base64');
    const jpegBuffer = await sharp(pngBuffer)
      .jpeg({ 
        quality: 85,  // 85% 품질로 압축
        progressive: true  // 점진적 로딩 지원
      })
      .toBuffer();
    
    console.log(`[generate-meal-image] 압축 완료: ${pngBuffer.length} → ${jpegBuffer.length} bytes (${Math.round((1 - jpegBuffer.length/pngBuffer.length) * 100)}% 감소)`);
    
    // 파일명 생성 (JPEG 포맷)
    const fileName = `ai_generated_${meal_id}_${Date.now()}.jpg`;
    
    // 압축된 JPEG 이미지를 Supabase Storage에 업로드
    console.log(`[generate-meal-image] Supabase Storage에 업로드 중: ${fileName}`);
    const { data: fileData, error: uploadError } = await supabaseAdmin.storage
      .from('meal-images')
      .upload(fileName, jpegBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });
      
    if (uploadError) {
      console.error('[generate-meal-image] 이미지 업로드 오류:', uploadError);
      throw uploadError;
    }
    
    // 이미지 URL 가져오기 (Service Role 사용)
    const { data: urlData } = supabaseAdmin.storage
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
    
    // meal_images 테이블 구조에 맞게 이미지 정보 저장 (Service Role 사용)
    // status='approved'로 설정하면 트리거로 자동 알림 발송
    const { data: imageRecord, error: dbError } = await supabaseAdmin
      .from('meal_images')
      .insert({
        meal_id: meal_id,
        image_url: publicUrl,
        uploaded_by: userId,
        status: 'approved',    // 중요: AI 이미지는 자동 승인
        match_score: 100,      // 100% 일치 (최대값으로 설정)
        source: 'user_ai',      // 사용자가 요청한 AI 이미지 표시
        explanation: 'AI가 생성한 급식 이미지입니다.'
      })
      .select()
      .single();
      
    if (dbError) {
      console.error('[generate-meal-image] DB 저장 오류:', dbError);
      throw dbError;
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`[generate-meal-image] 성공: 이미지 ID ${imageRecord.id} (총 소요시간: ${totalTime}ms)`);
    
    // 중요: 알림 관련 로직 제거
    // meal_images 테이블에 이미지 정보가 저장되면 트리거로 자동 알림 발송
    // status='approved'로 설정되어 있으므로 추가 작업 필요 없음
    console.log('[generate-meal-image] 이미지 저장 완료 - 자동 트리거로 알림 처리 예상');
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        image: imageRecord,
        executionTime: totalTime
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
