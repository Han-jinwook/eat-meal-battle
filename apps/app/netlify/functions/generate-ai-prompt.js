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

  const prompt = `# 🍽️ ${schoolName} ${period} 급식 브리핑 리포트

안녕하세요! ${schoolName} 급식 담당자님들께 ${period} 급식 현황을 브리핑드립니다. 😊

## 📋 **우리 아이들의 급식 평가 현황**

${schoolName} 학생들이 ${myRatingCount.toLocaleString()}번의 평가를 통해 솔직한 의견을 남겨주었습니다.
평균 **${myRating.toFixed(2)}점**으로, ${myRating >= 4.0 ? '정말 훌륭한' : myRating >= 3.5 ? '양호한' : myRating >= 3.0 ? '보통' : '개선이 필요한'} 수준입니다.

### 🏆 **우리학교 위치는?**
- **${region} 지역**: ${regionalTotal}개교 중 **${regionalRank}위** 
  ${regionalRank <= Math.ceil(regionalTotal * 0.3) ? '👏 상위권 진입! 지역에서 인정받는 급식입니다!' : 
    regionalRank <= Math.ceil(regionalTotal * 0.7) ? '📈 중위권이네요. 조금만 더 노력하면 상위권 도약 가능!' : 
    '💪 하위권이지만 개선 여지가 충분합니다!'}

- **전국 순위**: ${nationalTotal.toLocaleString()}개교 중 **${nationalRank}위** (상위 ${percentile}%)
  ${percentile >= 70 ? '🎉 전국 상위권! 정말 자랑스럽습니다!' : 
    percentile >= 50 ? '👍 전국 중상위권, 더 올라갈 수 있어요!' : 
    percentile >= 30 ? '📊 전국 중위권, 발전 가능성이 큽니다!' : 
    '🚀 아직 하위권이지만 상승 잠재력이 있습니다!'}

## 🍽️ **아이들이 사랑하는 메뉴 TOP 5**

${topMenus.slice(0, 5).map((menu, index) => {
  const dateStr = menu.meal_date ? new Date(menu.meal_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) : '';
  const mealTypeStr = menu.meal_type === 'lunch' ? '점심' : menu.meal_type === 'dinner' ? '저녁' : '';
  return `**${index + 1}위. ${menu.menu_name}** ⭐ ${menu.avg_rating.toFixed(2)}점
   📅 ${dateStr} ${mealTypeStr} | 📊 ${menu.rating_count}명 평가
   🏆 **성공 비결 분석 필수**: 왜 아이들이 "${menu.menu_name}"을 이렇게 좋아했을까요?
   💡 **구체적 분석 포인트**: 
       - 이 메뉴의 재료, 조리법, 비주얼, 온도감의 특징은?
       - 다른 메뉴에 어떻게 적용할 수 있을까요?
       - ${dateStr}에 제공된 이유가 성공에 영향을 줬을까요? (날씨, 계절감 등)`
}).join('\n\n')}

## 😅 **개선이 필요한 메뉴들 (구체적 분석 필수!)**

${worstMenus.slice(0, 3).map((menu, index) => {
  const dateStr = menu.meal_date ? new Date(menu.meal_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) : '';
  const mealTypeStr = menu.meal_type === 'lunch' ? '점심' : menu.meal_type === 'dinner' ? '저녁' : '';
  return `**❌ ${menu.menu_name}** 📉 ${menu.avg_rating.toFixed(2)}점
   📅 ${dateStr} ${mealTypeStr} | 📊 ${menu.rating_count}명이 평가
   ⚠️ **시급한 개선 필요**: "${menu.menu_name}"이 왜 낮은 점수를 받았을까요?
   🔍 **구체적 개선 방향**: 
       - 이 메뉴의 어떤 부분이 아이들에게 아쉬웠을까요?
       - ${dateStr}에 제공된 것이 문제였을까요? (날씨, 타이밍 등)
       - 양념, 조리법, 플레이팅 중 어떤 부분을 개선하면 좋을까요?
       - 다음에 다시 제공할 때 어떻게 바꿔야 할까요?`
}).join('\n\n')}

## 📊 **성과 분석 & 제안사항**

### ${myRating > regionalAvg ? '🎉 **칭찬할 점**' : '💡 **개선 포인트**'}
${myRating > regionalAvg ? 
  `지역 평균(${regionalAvg.toFixed(2)}점)보다 ${(myRating - regionalAvg).toFixed(2)}점 높습니다! 급식실 선생님들의 노고가 빛을 발하고 있어요. 👏` :
  `지역 평균(${regionalAvg.toFixed(2)}점)보다 ${Math.abs(myRating - regionalAvg).toFixed(2)}점 낮습니다. 하지만 충분히 개선 가능합니다!`}

${myRating > nationalAvg ? 
  `전국 평균(${nationalAvg.toFixed(2)}점)보다도 ${(myRating - nationalAvg).toFixed(2)}점 높아서 정말 자랑스럽습니다! 🌟` :
  `전국 평균(${nationalAvg.toFixed(2)}점)보다 ${Math.abs(myRating - nationalAvg).toFixed(2)}점 낮지만, 이는 곧 성장 기회입니다!`}

---

## 🎯 **AI 분석 요청사항**

위 데이터를 바탕으로 **브리핑 스타일**로 친근하게 분석해 주세요:

### 🔍 **아이들 입맛 트렌드 분석**
1. **인기 메뉴 분석**: 높은 점수를 받은 메뉴들의 공통점은? 요즘 아이들이 왜 이런 음식을 좋아할까요?
2. **저평점 메뉴 분석**: 낮은 점수를 받은 이유를 최근 아이들 입맛 트렌드 관점에서 분석해주세요.
3. **세대별 차이**: 어른들이 생각하는 '좋은 급식'과 아이들이 원하는 급식의 차이점은?

### 👨‍🍳 **급식실 분들께 드리는 말씀**
1. **잘하고 있는 점**: ${regionalPerformance === '상위권' || nationalPerformance === '상위권' ? '현재 좋은 성과를 내고 있는 부분에 대해 구체적으로 칭찬해주세요.' : ''}
2. **개선 방향**: ${regionalPerformance === '하위권' || nationalPerformance === '하위권' ? '아이들 입맛 연구와 벤치마킹이 필요한 부분을 친근하게 제안해주세요.' : '더 나은 급식을 위한 발전 방향을 제시해주세요.'}

### 🏫 **다른 학교 벤치마킹**
1. **1등 학교 분석**: 우리 지역이나 전국에서 1등 하는 학교들은 어떤 메뉴로 성공했을까요?
2. **성공 사례**: 비슷한 환경의 학교 중 급식 만족도가 높은 곳의 노하우는?
3. **실현 가능한 벤치마킹**: 우리 학교에서도 당장 적용할 수 있는 아이디어는?

### 💡 **구체적 실행 방안**
1. **단기 개선안** (1-2개월 내): 바로 시도해볼 수 있는 것들
2. **중기 계획** (3-6개월): 체계적으로 준비할 것들  
3. **장기 비전** (1년 이상): 우리학교 급식의 목표와 방향

---

### 🏆 6. 벤치마킹
- 우리 지역에서 우수한 학교들의 특징을 분석해주세요
- 전국 상위권 학교들과의 차이점을 파악해주세요
- 벤치마킹할 만한 구체적인 사례를 제시해주세요

---

## ⚠️ **중요: 분석 시 반드시 지켜야 할 원칙**

**🎯 구체성 원칙 (절대 일반론 금지!)**
- 위에 제시된 **실제 메뉴명을 반드시 언급**하며 분석하세요
- "인기 메뉴들", "저평점 메뉴들" 같은 추상적 표현 금지
- 예: "김치찌개가 4.8점을 받은 이유는..." (O) vs "찌개류가 인기인 이유는..." (X)

**💡 실용성 원칙 (어른들을 설득하라!)**
- 급식실 선생님들이 **내일 당장 실행할 수 있는** 구체적 방법 제시
- 예산, 시설, 인력을 고려한 현실적 개선안 필요
- 학부모들이 "우리 학교 급식이 좋아졌다"고 느낄 수 있는 변화 제안

**🔥 임팩트 원칙 (가슴에 와닿게!)**
- 데이터를 단순 나열하지 말고 **스토리텔링**으로 전달
- 아이들의 마음을 읽어내는 따뜻한 시선으로 분석
- 급식이 단순한 식사가 아닌 **교육과 성장의 도구**임을 강조

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
      .select('school_name, region, school_type')
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
          period: analysis_data.school_info?.period || '기간 없음',
          average_rating: analysis_data.my_school_performance?.avg_rating || 0,
          regional_rank: analysis_data.regional_comparison?.my_regional_rank || 0,
          national_percentile: analysis_data.national_comparison?.my_percentile || 0,
          total_menus: analysis_data.menu_performance?.total_menus || 0,
          better_than_national_menus: analysis_data.menu_performance?.better_than_national || 0
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
