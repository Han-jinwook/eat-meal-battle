const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 시뮬레이션된 NEIS API - 월간 급식일수 가져오기
async function getMonthlyMealDays(schoolCode, grade, year, month) {
  // 실제 환경에서는 NEIS API 호출
  // 현재는 시뮬레이션: 일반적으로 월당 20-22일이 급식일
  return Math.floor(Math.random() * 3) + 20; // 20, 21, 22 중 하나 반환
}

// 월간 장원 기준 계산 및 저장 (매월 말일)
async function calculateMonthlyChampionCriteria() {
  const TEST_MODE = true; // 테스트 모드
  
  console.log('월간 장원 기준 계산 시작 (매월 말일)...');
  
  try {
    // 모든 학교 가져오기
    const { data: schools, error: schoolError } = await supabase
      .from('schools')
      .select('id, school_code, name');

    if (schoolError) throw schoolError;

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    for (const school of schools) {
      for (let grade = 1; grade <= 6; grade++) {
        // 이번 달 급식일수 가져오기
        const mealDays = await getMonthlyMealDays(school.school_code, grade, currentYear, currentMonth);
        
        // 월간 장원 기준 계산 (일반적으로 급식일의 85% 이상)
        const monthlyRequirement = Math.ceil(mealDays * 0.85);
        
        // champion_criteria 테이블에 저장 또는 업데이트
        const { error: upsertError } = await supabase
          .from('champion_criteria')
          .upsert({
            school_id: school.id,
            grade: grade,
            year: currentYear,
            month: currentMonth,
            meal_days: mealDays,
            monthly_requirement: monthlyRequirement,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'school_id,grade,year,month'
          });

        if (upsertError) {
          console.error(`월간 기준 저장 오류 (학교: ${school.name}, 학년: ${grade}):`, upsertError);
        } else {
          console.log(`월간 장원 기준 설정 완료: ${school.name} ${grade}학년 - 급식일: ${mealDays}일, 요구사항: ${monthlyRequirement}일`);
        }
      }
    }
    
    console.log('월간 장원 기준 계산 완료 (매월 말일)');
    return { success: true, message: '월간 장원 기준 계산 완료 (매월 말일)' };
    
  } catch (error) {
    console.error('월간 장원 기준 계산 오류:', error);
    throw error;
  }
}

exports.handler = async (event, context) => {
  try {
    const result = await calculateMonthlyChampionCriteria();
    
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('월간 장원 기준 계산 함수 오류 (매월 말일):', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: '월간 장원 기준 계산 실패 (매월 말일)',
        details: error.message
      })
    };
  }
};
