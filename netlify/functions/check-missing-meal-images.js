// 12:30에 자동 실행되는 스케줄러 함수
// 이미지가 없거나 공유되지 않은 급식을 찾아 플래그 설정

const { createClient } = require('@supabase/supabase-js');

// dotenv 사용 - Netlify 환경에서는 필요없지만 로컬 개발용
// try-catch로 감싸서 오류 방지
try {
  require('dotenv').config();
} catch (e) {
  console.log('dotenv 모듈을 로드할 수 없습니다. Netlify 환경에서는 정상입니다.');
}

exports.handler = async (event) => {
  try {
    // Supabase 클라이언트 초기화
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // 오늘 날짜 가져오기
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`[check-missing-meal-images] 실행 시작: ${today}`);
    
    // 오늘 등록된 모든 급식 가져오기
    const { data: todayMeals, error: mealsError } = await supabase
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
    
    if (!todayMeals || todayMeals.length === 0) {
      console.log('[check-missing-meal-images] 오늘 등록된 급식이 없습니다.');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: '오늘 등록된 급식이 없습니다.' })
      };
    }
    
    console.log(`[check-missing-meal-images] 오늘의 급식 수: ${todayMeals.length}`);
    
    // 각 급식에 대해 이미지 상태 확인
    const mealsWithoutSharedImages = [];
    
    for (const meal of todayMeals) {
      // 이미지 조회
      const { data: images, error: imagesError } = await supabase
        .from('meal_images')
        .select('id, is_shared, match_score')
        .eq('meal_id', meal.id);
      
      if (imagesError) {
        console.error(`급식 ID ${meal.id}의 이미지 조회 오류:`, imagesError);
        continue;
      }
      
      // 이미지가 없거나, 공유된 이미지가 없는 경우 플래그 추가
      const hasSharedImage = images && images.some(img => img.is_shared === true);
      
      if (!images || images.length === 0 || !hasSharedImage) {
        mealsWithoutSharedImages.push({
          id: meal.id,
          school_code: meal.school_code,
          meal_date: meal.meal_date,
          meal_type: meal.meal_type,
          menu_items: meal.menu_items
        });
      }
    }
    
    console.log(`[check-missing-meal-images] AI 이미지가 필요한 급식 수: ${mealsWithoutSharedImages.length}`);
    
    // 결과를 Redis나 다른 캐시 저장소에 저장 (추후 구현)
    // 현재는 콘솔 로그로 확인만 함
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `${mealsWithoutSharedImages.length}개의 급식에 AI 이미지가 필요합니다.`,
        meals: mealsWithoutSharedImages.map(m => m.id)
      })
    };
  } catch (error) {
    console.error('[check-missing-meal-images] 오류:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message || '서버 오류가 발생했습니다.'
      })
    };
  }
};
