const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * AI 분석용 구조화된 프롬프트 생성
 * 수집된 급식 데이터를 바탕으로 GPT 앱들이 분석할 수 있는 상세한 프롬프트 생성
 */
function generateAIAnalysisPrompt(analysisData) {
  const { monthly_stats, regional_ranking, national_comparison, menu_trends } = analysisData;
  
  // 학교 기본 정보
  const schoolInfo = regional_ranking.my_school;
  const period = monthly_stats.period;
  
  // 성과 지표 계산
  const regionalPerformance = regional_ranking.my_school.rank <= Math.ceil(regional_ranking.regional_stats.total_schools * 0.3) ? "상위권" : 
                             regional_ranking.my_school.rank <= Math.ceil(regional_ranking.regional_stats.total_schools * 0.7) ? "중위권" : "하위권";
  
  const nationalPerformance = national_comparison.my_school_national?.percentile >= 70 ? "상위권" : 
                             national_comparison.my_school_national?.percentile >= 30 ? "중위권" : "하위권";

  const prompt = `# 🍽️ ${schoolInfo.school_name} ${period} 급식 평가 분석 리포트

## 📋 분석 개요
- **분석 대상**: ${schoolInfo.school_name} (${regional_ranking.region} ${regional_ranking.district})
- **분석 기간**: ${period}
- **총 급식일수**: ${monthly_stats.total_meal_days}일
- **총 평가 참여**: ${monthly_stats.total_ratings.toLocaleString()}건

## 🏆 종합 성과 요약

### 📊 우리학교 급식 평점
- **월간 평균 평점**: ${monthly_stats.average_rating.toFixed(2)}점 (5점 만점)
- **지역 내 순위**: ${regional_ranking.regional_stats.total_schools}개교 중 **${regional_ranking.my_school.rank}위** (${regionalPerformance})
- **전국 순위**: ${national_comparison.national_stats.total_schools.toLocaleString()}개교 중 **${national_comparison.my_school_national?.national_rank || 'N/A'}위** (상위 ${national_comparison.my_school_national?.percentile || 0}%, ${nationalPerformance})

### 🎯 비교 분석
- **지역 평균 대비**: ${(monthly_stats.average_rating - regional_ranking.regional_stats.average_rating).toFixed(2)}점 ${monthly_stats.average_rating > regional_ranking.regional_stats.average_rating ? '높음 ⬆️' : '낮음 ⬇️'}
- **전국 평균 대비**: ${(monthly_stats.average_rating - national_comparison.national_stats.average_rating).toFixed(2)}점 ${monthly_stats.average_rating > national_comparison.national_stats.average_rating ? '높음 ⬆️' : '낮음 ⬇️'}

## 📈 상세 분석 데이터

### 1️⃣ 월간 급식 통계
\`\`\`
총 급식일수: ${monthly_stats.total_meal_days}일
평균 평점: ${monthly_stats.average_rating.toFixed(2)}점
총 평가 수: ${monthly_stats.total_ratings.toLocaleString()}건

평점 분포:
- ⭐ 1점: ${monthly_stats.rating_distribution.rating_1}건 (${((monthly_stats.rating_distribution.rating_1 / monthly_stats.total_ratings) * 100).toFixed(1)}%)
- ⭐⭐ 2점: ${monthly_stats.rating_distribution.rating_2}건 (${((monthly_stats.rating_distribution.rating_2 / monthly_stats.total_ratings) * 100).toFixed(1)}%)
- ⭐⭐⭐ 3점: ${monthly_stats.rating_distribution.rating_3}건 (${((monthly_stats.rating_distribution.rating_3 / monthly_stats.total_ratings) * 100).toFixed(1)}%)
- ⭐⭐⭐⭐ 4점: ${monthly_stats.rating_distribution.rating_4}건 (${((monthly_stats.rating_distribution.rating_4 / monthly_stats.total_ratings) * 100).toFixed(1)}%)
- ⭐⭐⭐⭐⭐ 5점: ${monthly_stats.rating_distribution.rating_5}건 (${((monthly_stats.rating_distribution.rating_5 / monthly_stats.total_ratings) * 100).toFixed(1)}%)
\`\`\`

### 2️⃣ 우수 메뉴 TOP 5
${monthly_stats.menu_stats.top_menus.map((menu, index) => 
  `${index + 1}. **${menu.name}** - ${menu.average_rating.toFixed(2)}점 (${menu.total_ratings}건 평가, ${menu.appearance_count}회 제공)`
).join('\n')}

### 3️⃣ 개선 필요 메뉴
${monthly_stats.menu_stats.worst_menus.map((menu, index) => 
  `${index + 1}. **${menu.name}** - ${menu.average_rating.toFixed(2)}점 (${menu.total_ratings}건 평가, ${menu.appearance_count}회 제공)`
).join('\n')}

### 4️⃣ 지역 내 위치
- **${regional_ranking.region} 지역 순위**: ${regional_ranking.regional_stats.total_schools}개교 중 ${regional_ranking.my_school.rank}위
- **지역 평균**: ${regional_ranking.regional_stats.average_rating.toFixed(2)}점
- **지역 1위 학교**: ${regional_ranking.regional_stats.top_3_schools[0]?.school_name} (${regional_ranking.regional_stats.top_3_schools[0]?.average_rating.toFixed(2)}점)

### 5️⃣ 전국 비교
- **전국 순위**: ${national_comparison.national_stats.total_schools.toLocaleString()}개교 중 ${national_comparison.my_school_national?.national_rank || 'N/A'}위
- **전국 평균**: ${national_comparison.national_stats.average_rating.toFixed(2)}점
- **상위 백분위**: ${national_comparison.my_school_national?.percentile || 0}%

### 6️⃣ 메뉴 트렌드 분석
- **전체 제공 메뉴**: ${menu_trends.my_school_comparison.total_menus}개
- **전국 평균보다 우수한 메뉴**: ${menu_trends.my_school_comparison.better_than_national}개
- **전국 평균보다 부족한 메뉴**: ${menu_trends.my_school_comparison.worse_than_national}개
- **전국 인기 메뉴 제공**: ${menu_trends.my_school_comparison.nationally_popular_served}개

#### 전국 대비 우수한 메뉴 TOP 5:
${menu_trends.my_school_comparison.top_performing_menus.slice(0, 5).map((menu, index) => 
  `${index + 1}. **${menu.menu_name}** - 우리학교 ${menu.my_school_rating.toFixed(2)}점 vs 전국 ${menu.national_average?.toFixed(2) || 'N/A'}점 (${menu.rating_difference > 0 ? '+' : ''}${menu.rating_difference?.toFixed(2) || 'N/A'}점 차이)`
).join('\n')}

#### 개선이 필요한 메뉴 TOP 3:
${menu_trends.my_school_comparison.underperforming_menus.slice(0, 3).map((menu, index) => 
  `${index + 1}. **${menu.menu_name}** - 우리학교 ${menu.my_school_rating.toFixed(2)}점 vs 전국 ${menu.national_average?.toFixed(2) || 'N/A'}점 (${menu.rating_difference > 0 ? '+' : ''}${menu.rating_difference?.toFixed(2) || 'N/A'}점 차이)`
).join('\n')}

### 7️⃣ 전국 인기 메뉴 TOP 10
${menu_trends.national_trends.top_20_popular_menus.slice(0, 10).map((menu, index) => 
  `${index + 1}. **${menu.menu_name}** - ${menu.average_rating.toFixed(2)}점 (${menu.total_ratings.toLocaleString()}건 평가, ${menu.school_count}개교 제공)`
).join('\n')}

## 🎯 AI 분석 요청

위의 데이터를 바탕으로 다음 관점에서 **전문적이고 실용적인 분석**을 제공해주세요:

### 📊 1. 현황 진단
- 우리학교 급식의 전반적인 수준은 어떤가요?
- 지역 및 전국 대비 우리학교의 위치는 적절한가요?
- 학생들의 만족도 패턴에서 발견되는 특징은 무엇인가요?

### 🎯 2. 강점 분석
- 우리학교가 특히 잘하고 있는 메뉴나 영역은 무엇인가요?
- 다른 학교 대비 우수한 점은 무엇인가요?
- 지속적으로 유지해야 할 강점은 무엇인가요?

### ⚠️ 3. 개선 과제
- 가장 시급하게 개선이 필요한 메뉴는 무엇인가요?
- 전국 트렌드 대비 부족한 부분은 무엇인가요?
- 학생 만족도 향상을 위한 우선순위는 무엇인가요?

### 💡 4. 구체적 개선 방안
- 평점이 낮은 메뉴의 개선 방향을 제시해주세요
- 전국 인기 메뉴 중 도입을 고려할 만한 것은 무엇인가요?
- 조리법이나 재료 개선을 통한 실질적 방안을 제안해주세요

### 📈 5. 목표 설정
- 다음 달 목표 평점과 달성 전략을 제시해주세요
- 지역 내 순위 향상을 위한 로드맵을 제안해주세요
- 장기적인 급식 품질 향상 계획을 수립해주세요

### 🏆 6. 벤치마킹
- 우리 지역에서 우수한 학교들의 특징을 분석해주세요
- 전국 상위권 학교들과의 차이점을 파악해주세요
- 벤치마킹할 만한 구체적인 사례를 제시해주세요

**분석 시 고려사항:**
- 데이터는 실제 학생들의 평가를 바탕으로 한 객관적 지표입니다
- 급식은 학생들의 건강과 학교생활 만족도에 직접적 영향을 미칩니다
- 실현 가능하고 구체적인 개선 방안을 중심으로 분석해주세요
- 예산과 현실적 제약을 고려한 우선순위를 제시해주세요

---
*이 리포트는 ${new Date().toLocaleDateString('ko-KR')}에 생성되었으며, 실제 학생 평가 데이터를 기반으로 작성되었습니다.*`;

  return prompt;
}

/**
 * 학교 정보 조회 (프롬프트 개인화용)
 */
async function getSchoolInfo(schoolCode) {
  try {
    const { data, error } = await supabase
      .from('school_infos')
      .select('school_name, region, district, school_type')
      .eq('school_code', schoolCode)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('학교 정보 조회 오류:', error);
    return null;
  }
}

/**
 * Netlify Function 핸들러
 */
exports.handler = async (event, context) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // OPTIONS 요청 처리
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // POST 요청만 허용
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const requestBody = JSON.parse(event.body || '{}');
    const { analysis_data, school_code } = requestBody;

    // 필수 데이터 검증
    if (!analysis_data || !school_code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing required data: analysis_data, school_code' 
        })
      };
    }

    console.log(`🚀 AI 프롬프트 생성 요청: ${school_code}`);

    // AI 분석용 프롬프트 생성
    const aiPrompt = generateAIAnalysisPrompt(analysis_data);
    
    // 학교 정보 추가 조회 (선택적)
    const schoolInfo = await getSchoolInfo(school_code);

    // 응답 데이터 구성
    const responseData = {
      success: true,
      data: {
        prompt: aiPrompt,
        school_info: schoolInfo,
        analysis_summary: {
          school_code: school_code,
          period: analysis_data.monthly_stats.period,
          average_rating: analysis_data.monthly_stats.average_rating,
          regional_rank: analysis_data.regional_ranking.my_school.rank,
          national_percentile: analysis_data.national_comparison.my_school_national?.percentile || 0,
          total_menus: analysis_data.menu_trends.my_school_comparison.total_menus,
          better_than_national_menus: analysis_data.menu_trends.my_school_comparison.better_than_national
        },
        generated_at: new Date().toISOString(),
        prompt_length: aiPrompt.length
      }
    };

    console.log(`✅ AI 프롬프트 생성 완료: ${aiPrompt.length}자`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseData)
    };

  } catch (error) {
    console.error('❌ AI 프롬프트 생성 오류:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
