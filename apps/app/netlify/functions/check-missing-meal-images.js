// 12:30에 자동 실행되는 스케줄러 함수
// 이미지가 없거나 공유되지 않은 급식을 찾음
// 1. 휴일이거나 급식 정보가 없으면 실행하지 않음
// 2. 오늘 날짜(당일)의 급식만 처리
// 3. 기능은 사용자가 해당 페이지 방문시 표시되는 버튼으로 구현

const { createClient } = require('@supabase/supabase-js');

// dotenv 사용 - Netlify 환경에서는 필요없지만 로컬 개발용
// try-catch로 감싸서 오류 방지
try {
  require('dotenv').config();
} catch (e) {
  console.log('dotenv 모듈을 로드할 수 없습니다. Netlify 환경에서는 정상입니다.');
}


  try {
    // Supabase 클라이언트 초기화
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // 오늘 날짜 확인 - 오늘의 급식만 처리
    const today = new Date().toISOString().split('T')[0];
    console.log(`[check-missing-meal-images] 실행 날짜: ${today}`);
    
    // 휴일 체크
    const { data: holidays, error: holidaysError } = await supabase
      .from('holidays')
      .select('date')
      .eq('date', today);
    
    if (holidaysError) {
      throw new Error(`휴일 조회 오류: ${holidaysError.message}`);
    }
    
    if (holidays && holidays.length > 0) {
      console.log(`[check-missing-meal-images] 오늘(${today})은 휴일입니다.`);
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: '오늘은 휴일입니다.',
          isHoliday: true
        })
      };
    }
    
    // 이미지 생성이 필요한 급식 항목 식별
    // 1) 이미지가 없거나
    // 2) 이미지는 있지만 승인되지 않은(status!='approved') 급식
    const { data: meals, error: mealsError } = await supabase
      .from('meals')
      .select(`
        id,
        school_code,
        meal_date,
        meal_type,
        menu_items
      `)
      .eq('meal_date', today)
      .eq('meal_type', '중식'); // 점심 급식만 대상으로
    
    if (mealsError) {
      throw new Error(`급식 조회 오류: ${mealsError.message}`);
    }
    
    if (mealsError) {
      console.error(`[check-missing-meal-images] 급식 조회 오류: ${mealsError.message}`);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: mealsError.message })
      };
    }
    
    if (!meals || meals.length === 0) {
      console.log(`[check-missing-meal-images] 오늘(${today})은 급식이 없는 날입니다. 휴일 또는 급식 정보 미등록.`);
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: '오늘은 급식이 없는 날입니다. 휴일 또는 급식 정보 미등록.',
          isHoliday: true
        })
      };
    }
    
    console.log(`[check-missing-meal-images] 오늘의 급식 수: ${meals.length}`);
    
    // 각 급식에 대해 이미지 상태 확인
    const mealsWithoutApprovedImages = [];
    
    for (const meal of meals) {
      // 이미지 조회
      const { data: images, error: imagesError } = await supabase
        .from('meal_images')
        .select('id, status, match_score')
        .eq('meal_id', meal.id);
      
      if (imagesError) {
        console.error(`급식 ID ${meal.id}의 이미지 조회 오류:`, imagesError);
        continue;
      }
      
      // 이미지가 없거나, 승인된 이미지가 없는 경우 플래그 추가
      const hasApprovedImage = images && images.some(img => img.status === 'approved');
      
      if (!images || images.length === 0 || !hasApprovedImage) {
        mealsWithoutApprovedImages.push({
          id: meal.id,
          school_code: meal.school_code,
          meal_date: meal.meal_date,
          meal_type: meal.meal_type,
          menu_items: meal.menu_items
        });
      }
    }
    
    console.log(`[check-missing-meal-images] AI 이미지가 필요한 급식 수: ${mealsWithoutApprovedImages.length}`);
    
    // 결과를 Redis나 다른 캐시 저장소에 저장 (추후 구현)
    // 현재는 콘솔 로그로 확인만 함
    
    const result = {
      mealsWithoutImages: mealsWithoutApprovedImages.map(m => m.id)
    };
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `${mealsWithoutApprovedImages.length}개의 급식에 이미지가 필요합니다.`,
        meals: result.mealsWithoutImages
      })
    };
  } catch (error) {
    console.error('[check-missing-meal-images] 오류:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message || '서버 오류가 발생했습니다.'
      })
