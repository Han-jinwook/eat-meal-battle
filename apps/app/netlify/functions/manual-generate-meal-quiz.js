const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// 환경 변수에서 값 가져오기
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Supabase Admin 클라이언트 초기화 (RLS 우회용)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 급식 메뉴 기반 퀴즈 프롬프트 생성
 * @param {Object} meal 급식 메뉴 정보
 * @param {number} grade 학년 (1-12)
 * @param {string} mealDate 급식 날짜 (YYYY-MM-DD)
 * @param {string} schoolCode 학교 코드
 * @param {string} schoolType 학교 유형 (초등학교, 중학교, 고등학교)
 * @returns {string} OpenAI에 전달할 프롬프트
 */
function generateQuizPrompt(meal, grade, mealDate, schoolCode, schoolType) {
  // 학년별 스타일 차등화를 위한 설정
  let difficultyLevel, optionComplexity;
  
  // 학교 유형이 없는 경우 학년으로 추측
  if (!schoolType) {
    schoolType = grade <= 6 ? '초등학교' : (grade <= 9 ? '중학교' : '고등학교');
  }
  
  // 학년과 학교 유형에 따른 기본 설정 분리
  if (schoolType === '초등학교' && grade <= 2) { // 초등 저학년
    difficultyLevel = '매우 쉽음';
    optionComplexity = '단어나 짧은 구문의 간단한 보기 (2~3단어)';
  } 
  else if (schoolType === '초등학교') { // 초등 중고학년
    difficultyLevel = grade <= 4 ? '쉽음' : '보통';
    optionComplexity = '구체적인 설명이 있는 보기 (한 문장 수준)';
  } 
  else if (schoolType === '중학교') { // 중학생
    difficultyLevel = '다소 어려움';
    optionComplexity = '복합적인 설명과 개념이 포함된 보기 (여러 요소 비교)';
  } 
  else { // 고등학생
    difficultyLevel = '어려움/복합적';
    optionComplexity = '복잡한 인과관계, 여러 개념을 결합한 보기, 미묘한 차이가 있는 선택지';
  }
  
  return `
급식 메뉴: ${meal.menu_items.join(', ')}
영양소 정보: ${meal.ntr_info || '정보 없음'}
원산지 정보: ${meal.origin_info || '정보 없음'}
대상: ${schoolType} ${grade}학년

위 급식 메뉴를 소재로 ${grade}학년에게 적합한 교육적 퀴즈를 만들어주세요.

**창의성 요구사항:**
- 급식 메뉴에서 출발하되, 다양한 교과 영역(수학, 과학, 역사, 지리, 문학, 예술 등)으로 자유롭게 확장
- 매번 완전히 다른 접근 방식과 문체 사용
- 특정 표현이나 패턴의 반복 금지
- ${grade}학년 수준에 맞는 어휘와 개념 사용

**난이도:** ${difficultyLevel}
**보기 스타일:** ${optionComplexity}

**중요:** 이전에 만든 문제와 완전히 다른 새로운 관점으로 접근하세요.할 만한", "롤 챔피언 이름 같은"
- "오징어 게임의 달고나 같은", "넷플릭스 드라마에 나올 법한"
- "인스타 스토리에 올릴 만한", "틱톡에서 트렌드가 될 법한"

**학년별 보기 구성 방식:**

**초등~중학년 (1-9학년):**
• 친숙한 문화 소재 + 간단명료한 설명
• 예시: "포켓몬 피카츄처럼 빠른 전기 전도체"

**고학년 (7-12학년, 특히 10-12학년):**
• 친숙한 문화 소재 + **복합적 개념 설명 (2-3단어 이상)**
• 단순 단어 나열 절대 금지, 각 보기마다 **사고 과정 필요**
• 예시 비교:
  - ❌ "산소", "질소", "수소", "탄소"
  - ✅ "오징어 게임의 달고나처럼 달콤한 광합성 부산물"
  - ✅ "넷플릭스 드라마처럼 대기의 78%를 차지하는 주인공"

**보기별 차별화 전략:**
• 각 보기가 서로 다른 관점이나 접근 방식을 제시
• 정답과 오답 사이에 **미묘하지만 중요한 차이점** 존재
• 학생들이 "왜 이 답이 맞고 저 답이 틀린지" 생각하게 만드는 구성
• 함정 요소보다는 **논리적 사고 과정**을 통해 구별 가능하도록 설계

⚠️ 중요 제약사항:
1. 단순 암기나 일반 상식 문제 금지
2. "대박", "완전", "진짜" 등 특정 감탄어 반복 사용 금지
3. 매번 새로운 관점과 접근 방식으로 문제 구성
4. **보기 구성 필수 규칙:**
   - **전 학년**: 각 나이대에 맞는 친숙한 문화 소재(방송/게임/밈/드라마 등)를 재치있게 활용
   - **초등~중학년**: 문화 소재 + 간단명료한 설명
   - **고학년(7-12학년)**: 문화 소재 + **복합적 개념 설명 (2-3단어 이상)**
   - 단순 단어 나열 절대 금지, 각 보기에서 사고력 요구
5. 해설에는 추가 학습 동기를 부여하는 흥미로운 정보 포함

🎯 최종 목표:
하루 1개씩 1년간 250개, 여러 해에 걸쳐 사용해도 지루하지 않고 
매번 새로운 발견과 학습의 즐거움을 주는 창의적이고 교육적인 퀴즈 생성

반환 형식:
JSON:
{
  "question": "문제 내용",
  "options": ["보기1", "보기2", "보기3", "보기4"],
  "correct_answer": 정답번호(0-3),
  "explanation": "해설"
}
${grade >= 10 ? '고등학생에게 적합한 전문적 용어와 학술적 접근을 반영할 것' : ''}

반환 형식:
JSON:
{
  "question": "문제 내용",
  "options": ["보기1", "보기2", "보기3", "보기4"],
  "correct_answer": 정답번호(0-3),
  "explanation": "해설"
}
`;
}

/**
 * OpenAI를 사용하여 급식 메뉴 기반 퀴즈 생성
 * @param {Object} meal 급식 메뉴 데이터
 * @param {number} grade 학년 (1-12)
 * @returns {Promise<Object>} 생성된 퀴즈 데이터
 */
const generateQuizWithAI = async function(meal, grade) {
  console.log(`[manual-generate-meal-quiz] ${grade}학년용 퀴즈 생성 시작`);
  
  // 학교 유형 정보 가져오기
  let schoolType;
  try {
    // 학교 정보에서 school_type 가져오기 시도
    const { data: schoolInfo } = await supabaseAdmin
      .from('school_infos')
      .select('school_type')
      .eq('school_code', meal.school_code)
      .single();
    
    if (schoolInfo && schoolInfo.school_type) {
      schoolType = schoolInfo.school_type;
      console.log(`[manual-generate-meal-quiz] 학교 유형 정보 찾음: ${schoolType}`);
    } else {
      // 학교 유형 정보가 없는 경우 학년으로 추측
      schoolType = grade <= 6 ? '초등학교' : (grade <= 9 ? '중학교' : '고등학교');
      console.log(`[manual-generate-meal-quiz] 학교 유형 정보 없음, 학년으로 추측: ${schoolType}`);
    }
  } catch (error) {
    // 오류 발생 시 학년으로 추측
    schoolType = grade <= 6 ? '초등학교' : (grade <= 9 ? '중학교' : '고등학교');
    console.log(`[manual-generate-meal-quiz] 학교 정보 조회 오류, 학년으로 추측: ${schoolType}`, error);
  }
  
  // OpenAI 프롬프트 생성
  const prompt = generateQuizPrompt(meal, grade, meal.meal_date, meal.school_code, schoolType);
  
  try {
    // OpenAI API 호출
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: "당신은 한국 교육과정에 맞는 교육적인 퀴즈를 생성하는 전문가입니다. 각 학년에 적합한 난이도와 주제로 퀴즈를 만들어주세요."
        },
        { 
          role: "user", 
          content: prompt 
        }
      ],
      temperature: 0.7,
    });

    // 응답 파싱
    const content = response.choices[0].message.content;
    console.log(`[manual-generate-meal-quiz] GPT 응답 수신: ${content.length}자`);
    
    // JSON 형식 추출 ('{...}' 형태의 문자열 찾기)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`[manual-generate-meal-quiz] JSON 형식을 찾을 수 없음`, content);
      throw new Error("JSON 형식을 찾을 수 없습니다");
    }
    
    try {
      // JSON 문자열 정리: 백틱 제거 및 이스케이프되지 않은 백슬래시 처리
      let jsonString = jsonMatch[0];
      jsonString = jsonString.replace(/`/g, ''); // 백틱 제거
      jsonString = jsonString.replace(/\\(?=["])/, '\\\\'); // 이스케이프되지 않은 백슬래시 처리
      
      // JSON 파싱
      const quizData = JSON.parse(jsonString);
      
      // 필수 필드 검증
      const requiredFields = ['question', 'options', 'correct_answer', 'explanation'];
      for (const field of requiredFields) {
        if (quizData[field] === undefined) {
          console.error(`[manual-generate-meal-quiz] 필수 필드 누락: ${field}`);
          throw new Error(`퀴즈 데이터에 필수 필드(${field})가 없습니다`);
        }
      }
      
      console.log(`[manual-generate-meal-quiz] 퀴즈 생성 성공: ${quizData.question.substring(0, 30)}...`);
      return quizData;
    } catch (parseError) {
      console.error(`[manual-generate-meal-quiz] JSON 파싱 오류:`, parseError);
      console.error(`[manual-generate-meal-quiz] 원본 JSON 문자열:`, jsonMatch[0]);
      throw new Error(`JSON 파싱 실패: ${parseError.message}`);
    }
  } catch (error) {
    console.error(`[manual-generate-meal-quiz] 퀴즈 생성 중 오류 발생:`, error);
    throw error; // 오류를 상위로 전달하여 재시도 로직에서 처리할 수 있게 함
  }
}

/**
 * 생성된 퀴즈를 DB에 저장
 * @param {Object} quiz 생성된 퀴즈 데이터
 * @param {Object} meal 급식 정보
 * @param {number} grade 학년
 * @returns {Promise<boolean>} 저장 성공 여부
 */
async function saveQuizToDatabase(quiz, meal, grade) {
  const { difficulty } = calculateEducationalLevel(grade);
  
  try {
    console.log(`[manual-generate-meal-quiz] ${meal.school_code} 학교 ${grade}학년 퀴즈 저장 중...`);
    
    const { data, error } = await supabaseAdmin
      .from('meal_quizzes')
      .insert({
        school_code: meal.school_code,
        grade: grade,
        meal_date: meal.meal_date,
        meal_id: meal.id,
        question: quiz.question,
        options: quiz.options,
        correct_answer: quiz.correct_answer,
        explanation: quiz.explanation || "추가 설명이 없습니다.",
        difficulty: difficulty
      })
      .select()
      .single();

    if (error) {
      console.error(`[manual-generate-meal-quiz] 퀴즈 저장 오류:`, error);
      return false;
    }

    console.log(`[manual-generate-meal-quiz] 퀴즈 저장 성공: ID=${data.id}`);
    return true;
  } catch (error) {
    console.error(`[manual-generate-meal-quiz] 퀴즈 저장 중 예외 발생:`, error);
    return false;
  }
}

// API 핸들러
// 핸들러 함수 명시적으로 export
const handler = async function(event, context) {
  // CORS 헤더
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // OPTIONS 요청 처리
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight response' })
    };
  }

  // 인증 처리
  let userId;
  try {
    const authHeader = event.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    
    // JWT 토큰 검증
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: '인증되지 않은 요청입니다.' })
      };
    }
    
    userId = user.id;
  } catch (error) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: '인증 처리 중 오류가 발생했습니다.' })
    };
  }

  // 요청 처리
  try {
    // 요청 데이터 파싱
    const { school_code, grade, date, meal_date, meal_id, user_id } = JSON.parse(event.body || '{}');
    
    // date 또는 meal_date 중 하나를 사용
    const targetDate = meal_date || date;
    
    // 필수 파라미터 검증
    if (!school_code || !grade || !targetDate) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: '필수 매개변수가 누락되었습니다.', 
          required: ['school_code', 'grade', 'date (또는 meal_date)'] 
        })
      };
    }
    
    // 학년 유효성 검사 (1-12학년)
    if (grade < 1 || grade > 12) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '유효하지 않은 학년입니다. 1-12 범위의 값을 입력하세요.' })
      };
    }
    
    // 이미 해당 날짜에 퀴즈가 존재하는지 확인
    const { data: existingQuiz } = await supabaseAdmin
      .from('meal_quizzes')
      .select('id')
      .eq('school_code', school_code)
      .eq('grade', grade)
      .eq('meal_date', targetDate)
      .limit(1);
      
    if (existingQuiz && existingQuiz.length > 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          exists: true,
          message: '이미 해당 날짜에 퀴즈가 존재합니다.',
          quiz_id: existingQuiz[0].id
        })
      };
    }
    
    // 급식 메뉴 정보 조회 (meal_id가 있으면 직접 조회, 없으면 날짜로 조회)
    let meal;
    if (meal_id) {
      const { data: mealData, error: mealError } = await supabaseAdmin
        .from('meal_menus')
        .select('*')
        .eq('id', meal_id)
        .eq('school_code', school_code)
        .eq('meal_date', targetDate)
        .single();
        
      if (mealError || !mealData) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            error: '해당 급식 정보를 찾을 수 없습니다.',
            details: mealError?.message
          })
        };
      }
      meal = mealData;
    } else {
      // meal_id가 없으면 날짜와 학교코드로 급식 메뉴 찾기
      const { data: mealData, error: mealError } = await supabaseAdmin
        .from('meal_menus')
        .select('*')
        .eq('school_code', school_code)
        .eq('meal_date', targetDate)
        .limit(1);
        
      if (mealError || !mealData || mealData.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            error: '해당 날짜의 급식 정보를 찾을 수 없습니다.',
            details: mealError?.message
          })
        };
      }
      meal = mealData[0];
    }
    
    console.log(`[manual-generate-meal-quiz] 급식 메뉴 조회 성공: ${meal.id}`);
    
    // 퀴즈 생성
    const quiz = await generateQuizWithAI(meal, grade);
    
    // DB에 저장
    const saved = await saveQuizToDatabase(quiz, meal, grade);
    
    if (!saved) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: '퀴즈를 저장하는 중 오류가 발생했습니다.' })
      };
    }
    
    // 성공 응답
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: '퀴즈가 성공적으로 생성되었습니다.',
        quiz: {
          question: quiz.question,
          meal_date: targetDate,
          grade: grade
        }
      })
    };
  } catch (error) {
    console.error(`[manual-generate-meal-quiz] 오류 발생:`, error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: '서버 오류가 발생했습니다.',
        message: error.message 
      })
    };
  }
};

// 외부에서 사용할 함수 export
module.exports = {
  generateQuizWithAI,
  handler
};
