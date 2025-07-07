// 오후 5시에 자동 실행되는 스케줄러 함수
// 이미지가 없거나 공유되지 않은 급식을 자동으로 AI 이미지 생성

const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');

// dotenv 사용 - 로컬 개발 환경용
try {
  require('dotenv').config();
} catch (e) {
  console.log('dotenv 모듈을 로드할 수 없습니다. Netlify 환경에서는 정상입니다.');
}

exports.handler = async function(event, context) {
  console.log('[auto-generate-meal-images] 함수 시작');
  
  try {
    // Supabase 클라이언트 초기화
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // OpenAI 클라이언트 초기화
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.');
    }
    
    // 오늘 날짜 확인 - 오늘의 급식만 처리
    const today = new Date().toISOString().split('T')[0];
    console.log(`[auto-generate-meal-images] 실행 날짜: ${today}`);
    
    // 휴일 체크
    const { data: holidays, error: holidaysError } = await supabase
      .from('holidays')
      .select('date')
      .eq('date', today);
    
    if (holidaysError) {
      throw new Error(`휴일 조회 오류: ${holidaysError.message}`);
    }
    
    if (holidays && holidays.length > 0) {
      console.log(`[auto-generate-meal-images] 오늘(${today})은 휴일입니다. 자동 생성 건너뜀.`);
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: '오늘은 휴일입니다.',
          isHoliday: true
        })
      };
    }
    
    // 이미지 생성이 필요한 급식 항목 식별 (오늘 날짜 & 중식 & 이미지 없음 또는 공유되지 않음)
    const { data: meals, error: mealsError } = await supabase
      .from('meals')
      .select(`
        id,
        school_code,
        meal_date,
        meal_type,
        menu_items,
        meal_images:meal_images(id, status)
      `)
      .eq('meal_date', today)
      .eq('meal_type', '중식'); // 점심 급식만 대상으로
    
    if (mealsError) {
      console.error(`[auto-generate-meal-images] 급식 조회 오류: ${mealsError.message}`);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: mealsError.message })
      };
    }
    
    if (!meals || meals.length === 0) {
      console.log(`[auto-generate-meal-images] 오늘(${today})은 급식이 없는 날입니다. 자동 생성 건너뜀.`);
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: '오늘은 급식이 없는 날입니다.',
          isHoliday: true
        })
      };
    }
    
    // 이미지가 없거나 승인되지 않은 급식 필터링
    const mealsNeedingImages = meals.filter(meal => {
      const hasImages = meal.meal_images && meal.meal_images.length > 0;
      if (!hasImages) return true; // 이미지 없음
      
      // 이미지는 있지만 승인된 이미지가 없는 경우
      return !meal.meal_images.some(img => img.status === 'approved');
    });
    
    console.log(`[auto-generate-meal-images] 이미지 생성이 필요한 급식 수: ${mealsNeedingImages.length}`);
    
    // 결과 추적
    const results = {
      success: [],
      failed: []
    };
    
    // 각 급식에 대해 이미지 자동 생성
    for (const meal of mealsNeedingImages) {
      try {
        if (!meal.menu_items || meal.menu_items.length === 0) {
          console.log(`[auto-generate-meal-images] 급식 ID ${meal.id}에 메뉴 항목이 없습니다. 건너뜀.`);
          results.failed.push({
            meal_id: meal.id,
            error: '메뉴 항목이 없습니다.'
          });
          continue;
        }
        
        console.log(`[auto-generate-meal-images] 급식 ID ${meal.id} 이미지 생성 시작...`);
        
        // 메뉴 항목을 문자열로 변환
        const menuString = meal.menu_items.join(', ');
        
        // GPT-4o 이미지 생성 모델로 이미지 생성
        const imageResponse = await openai.images.generate({
          model: "gpt-image-1", // GPT-4o의 이미지 생성 모델
          prompt: `한국 학교 급식 - 6칸 스테인리스 식판에 실제처럼 촬영한 사진. 실사처럼 보이는 포토리얼리스틱 품질. 위에서 내려다보는 각도(탑다운뷰).

메뉴 항목: ${menuString}

식판 배치:
- 하단 왼쪽 큰 칸: 흰쌀밥이나 잡곡밥 (비어있지 않고 가득 채워진 상태)
- 하단 오른쪽 큰 칸: 국 또는 찌개 (원산지한국 스타일, 건더기가 보이는 맑은 국물)
- 상단 왼쪽부터 4개 작은 칸: 다양한 반찬들 (김치, 나물, 고기, 생선 등 골고루)

특징:
- 실사처럼 보이는 사진 표현 (실제 음식을 찍은 사진처럼 자연스럽고 생생함)
- 모든 칸이 비어있지 않고 음식으로 적절히 채워져 있음
- 음식은 실제 학교 급식처럼 깔끔하게 정돈되어 있음
- 밝은 조명, 선명한 색감, 고품질의 사진같은 표현
- 메뉴는 위 목록의 항목들로 실제 한국 급식 스타일로 표현`,
          n: 1,
          size: "1536x1024", // 식판은 가로가 더 길기 때문에 가로형 이미지 사용
          quality: "low",    // 데이터 가볍고 처리 속도 빠름(low, medium, high 중 선택)
        });
        
        if (!imageResponse.data || imageResponse.data.length === 0) {
          throw new Error('이미지 생성에 실패했습니다.');
        }
        
        // 이미지 데이터 처리
        const item = imageResponse.data[0];
        let imageData;
        
        // URL 또는 b64_json 여부 확인
        if (item.url) {
          // URL이 있는 경우 다운로드 후 처리
          console.log(`[auto-generate-meal-images] URL 형식의 이미지 데이터 받음`);
          console.log('[auto-generate-meal-images] 이미지 다운로드 중...');
          const imageRes = await fetch(item.url);
          const imageBuffer = await imageRes.arrayBuffer();
          imageData = Buffer.from(imageBuffer).toString('base64');
        } else if (item.b64_json) {
          // Base64 데이터가 바로 있는 경우
          console.log('[auto-generate-meal-images] b64_json 형식의 이미지 데이터 받음');
          imageData = item.b64_json;
        } else {
          throw new Error('이미지 데이터가 없습니다.');
        }
        
        console.log(`[auto-generate-meal-images] 이미지 데이터 길이=${imageData.length}`);
        const base64Image = imageData; // 사용하는 변수명 유지
        
        // 파일명 생성
        const fileName = `ai_auto_${meal.id}_${Date.now()}.png`;
        
        // 이미지를 Supabase Storage에 업로드
        const { data: fileData, error: uploadError } = await supabase.storage
          .from('meal-images')
          .upload(fileName, Buffer.from(base64Image, 'base64'), {
            contentType: 'image/png',
            upsert: true
          });
          
        if (uploadError) {
          throw uploadError;
        }
        
        // 이미지 URL 가져오기
        const { data: urlData } = supabase.storage
          .from('meal-images')
          .getPublicUrl(fileName);
          
        const publicUrl = urlData.publicUrl;
        
        // 시스템 사용자 정보 가져오기 (관리자 또는 시스템)
        const { data: adminUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'admin')
          .limit(1)
          .single();
          
        const userId = adminUser?.id || 'system';
        
        // DB에 이미지 정보 저장
        const { data: imageRecord, error: dbError } = await supabase
          .from('meal_images')
          .insert({
            meal_id: meal.id,
            image_url: publicUrl,
            uploaded_by: userId,
            school_code: meal.school_code,
            meal_date: meal.meal_date,
            meal_type: meal.meal_type,
            status: 'approved',      // AI 생성 이미지는 자동 승인
            match_score: 90,         // 높은 매치 스코어
            source: 'auto_ai',      // 자동 시스템에 의해 생성된 AI 이미지 표시
            explanation: '[자동생성] AI가 생성한 급식 이미지입니다.'
          })
          .select()
          .single();
          
        if (dbError) {
          throw dbError;
        }
        
        console.log(`[auto-generate-meal-images] 급식 ID ${meal.id} 이미지 생성 완료!`);
        
        // 학교 ID 가져오기
        const { data: mealData } = await supabase
          .from('meals')
          .select('school_id')
          .eq('id', meal.id)
          .single();
          
        // 알림 생성 코드 제거 - 트리거로 대체
        // meal_images에 status='approved'로 이미지 저장시 트리거가 자동으로 알림 생성
        console.log(`[auto-generate-meal-images] 급식 ID ${meal.id} 이미지 생성 완료 - 알림은 트리거로 자동 생성됩니다.`);
        
        results.success.push({
          meal_id: meal.id,
          image_id: imageRecord.id
        });
        
      } catch (error) {
        console.error(`[auto-generate-meal-images] 급식 ID ${meal.id} 이미지 생성 오류:`, error);
        results.failed.push({
          meal_id: meal.id,
          error: error.message
        });
      }
    }
    
    // 결과 응답
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `${mealsNeedingImages.length}개 급식 중 ${results.success.length}개 성공, ${results.failed.length}개 실패`,
        results
      })
    };
    
  } catch (error) {
    console.error('[auto-generate-meal-images] 오류:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: error.message || '서버 오류가 발생했습니다'
      })
    };
  }
}
