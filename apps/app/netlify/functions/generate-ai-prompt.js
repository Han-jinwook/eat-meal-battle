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
  // 신버전 데이터 구조에 맞게 완전히 새로 작성
  const { school_info, my_school_performance, menu_performance, national_comparison, regional_comparison } = analysisData;
  
  // 안전한 데이터 접근
  const schoolName = school_info?.school_name || '학교명 없음';
  const region = school_info?.region || '지역 없음';
  const period = school_info?.period || '기간 없음';
  
  const myRating = my_school_performance?.avg_rating || 0;
  const myRatingCount = my_school_performance?.rating_count || 0;
  
  const nationalRank = national_comparison?.my_national_rank || 0;
  const nationalTotal = national_comparison?.total_schools || 0;
  const nationalAvg = national_comparison?.national_average || 0;
  const percentile = national_comparison?.my_percentile || 0;
  
  const regionalRank = regional_comparison?.my_regional_rank || 0;
  const regionalTotal = regional_comparison?.total_schools || 0;
  const regionalAvg = regional_comparison?.regional_average || 0;
  
  const topMenus = menu_performance?.top_menus || [];
  const worstMenus = menu_performance?.worst_menus || [];
  
  // 성과 지표 계산
  const regionalPerformance = regionalRank <= Math.ceil(regionalTotal * 0.3) ? "상위권" : 
                             regionalRank <= Math.ceil(regionalTotal * 0.7) ? "중위권" : "하위권";
  
  const nationalPerformance = percentile >= 70 ? "상위권" : 
                             percentile >= 30 ? "중위권" : "하위권";

  const prompt = `# 🍽️ ${schoolName} ${period} 급식 평가 분석 리포트

## 📋 분석 개요
- **분석 대상**: ${schoolName} (${region})
- **분석 기간**: ${period}
- **총 평가 참여**: ${myRatingCount.toLocaleString()}건

## 🏆 종합 성과 요약

### 📊 우리학교 급식 평점
- **월간 평균 평점**: ${myRating.toFixed(2)}점 (5점 만점)
- **지역 내 순위**: ${regionalTotal}개교 중 **${regionalRank}위** (${regionalPerformance})
- **전국 순위**: ${nationalTotal.toLocaleString()}개교 중 **${nationalRank}위** (상위 ${percentile}%, ${nationalPerformance})

### 🎯 비교 분석
- **지역 평균 대비**: ${(myRating - regionalAvg).toFixed(2)}점 ${myRating > regionalAvg ? '높음 ⬆️' : '낮음 ⬇️'}
- **전국 평균 대비**: ${(myRating - nationalAvg).toFixed(2)}점 ${myRating > nationalAvg ? '높음 ⬆️' : '낮음 ⬇️'}

## 📈 상세 분석 데이터

### 1️⃣ 메뉴별 성과 분석
\`\`\`
상위 메뉴 TOP 5:
${topMenus.slice(0, 5).map((menu, index) => `${index + 1}. ${menu.menu_name}: ${menu.avg_rating.toFixed(2)}점 (${menu.rating_count}회 평가)`).join('\n')}

개선 필요 메뉴:
${worstMenus.map((menu, index) => `${index + 1}. ${menu.menu_name}: ${menu.avg_rating.toFixed(2)}점 (${menu.rating_count}회 평가)`).join('\n')}
\`\`\`

### 2️⃣ 지역 내 순위 (${region})
\`\`\`
우리학교 순위: ${regionalRank}위 / ${regionalTotal}개교
지역 평균 평점: ${regionalAvg.toFixed(2)}점
우리학교 평점: ${myRating.toFixed(2)}점
\`\`\`

### 3️⃣ 전국 순위 비교
\`\`\`
전국 순위: ${nationalRank}위 / ${nationalTotal.toLocaleString()}개교
전국 평균: ${nationalAvg.toFixed(2)}점
상위 백분위: ${percentile}%
\`\`\`

### 4️⃣ 메뉴 성과 요약
- **전체 제공 메뉴**: ${menu_performance?.total_menus || 0}개
- **우수 메뉴**: ${menu_performance?.better_than_national || 0}개
- **개선 필요 메뉴**: ${menu_performance?.worse_than_national || 0}개

## 🎯 AI 분석 요청

위의 데이터를 바탕으로 다음 사항들을 분석해 주세요:

### 📊 성과 분석
1. **종합 평가**: 우리학교의 급식 서비스 전반적인 수준은 어떤가요?
2. **강점 분석**: 어떤 부분에서 우수한 성과를 보이고 있나요?
3. **개선점 발견**: 어떤 영역에서 개선이 필요한가요?

### 🍽️ 메뉴 개선 제안
1. **인기 메뉴 활용**: 높은 평점을 받은 메뉴들의 공통점은 무엇인가요?
2. **저평점 메뉴 개선**: 낮은 평점을 받은 메뉴들을 어떻게 개선할 수 있을까요?
3. **신메뉴 제안**: 학생들이 좋아할 만한 새로운 메뉴를 제안해 주세요.

### 📈 전략적 제안
1. **지역 내 순위 향상**: 지역 내에서 순위를 올리기 위한 구체적인 방안은?
2. **전국 평균 달성**: 전국 평균에 도달하기 위해 필요한 개선사항은?
3. **장기 발전 계획**: 지속적인 급식 품질 향상을 위한 로드맵을 제시해 주세요.

### 💡 실행 가능한 액션 아이템
구체적이고 실행 가능한 개선 방안을 우선순위별로 제시해 주세요.
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
