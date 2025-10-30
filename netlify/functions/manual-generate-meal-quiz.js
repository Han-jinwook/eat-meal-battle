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
  // 학교 유형이 없는 경우 처리
  if (!schoolType) {
    console.error('[manual-generate-meal-quiz] school_type 조회 실패 - 기본값 없이 진행');
    console.log(`[DEBUG] generateQuizPrompt 함수: schoolType이 없음, '정보없음'으로 설정`);
    console.log(`[DEBUG] 코드 버전: 2025-10-30 개선 압축 프롬프트`);
    schoolType = '정보없음'; // fallback 로직 제거
  } else {
    console.log(`[DEBUG] generateQuizPrompt 함수: schoolType = ${schoolType}`);
  }
  
  // 학년별 엄격한 제한 설정
  const gradeLimit = schoolType === '초등학교' && grade <= 2 ? 
    '초저: 색깔/맛/모양 관찰만, 추상개념 금지' :
    schoolType === '초등학교' ? 
    '초등: 기초 암기 위주, 복잡한 원리 금지' :
    schoolType === '중학교' ? 
    '중학: 교과서 기본 원리만, 고등 내용 금지' :
    '고등: 교과서 범위만, 대학 수준 금지';

  return `
당신은 "대한민국 학교 급식 교육 콘텐츠 전문가"입니다.
다음 정보를 기반으로 한국의 학생을 위한 "AI 급식퀴즈"를 만드세요.

급식 메뉴: ${meal.menu_items.join(', ')}
영양소: ${meal.ntr_info || '정보 없음'}
원산지: ${meal.origin_info || '정보 없음'}
대상: 한국 ${schoolType} ${grade}학년

🎯 필수 원칙
- 정답: ${schoolType} 교과서 확인 가능한 사실만
- 오답: 명확히 틀린 정보
- 금지어: "~카더라", "~것 같다", "~알려짐", "최근", "요즘", "트렌드"
- 금지 내용: 민간요법, 광고성, 검증되지 않은 정보
- 교과 연결: 급식→영양/과학/지리/역사/사회 (단순 연결만)

📚 학년 제한 (엄격 준수)
${gradeLimit}

✅ 안전 패턴 (필수 선택)
1. 영양소형: "○○에 많은 영양소는?" (기본 영양소→기능)
2. 원산지형: "○○의 주산지는?" (지역→특징)  
3. 조리형: "○○을 ○○하는 이유는?" (조리법→과학원리)
4. 역사형: "○○이 전래된 시기는?" (정확한 연도 필수)

👍 톤: 따뜻한 대화, "오늘 급식 어땠어?" 분위기, 유행어 금지

JSON: {"question":"문장","options":["보기1","보기2","보기3","보기4"],"correct_answer":숫자,"explanation":"교과서 수준 설명"}
`;
}

/**
 * OpenAI를 사용하여 급식 메뉴 기반 퀴즈 생성
 * @param {Object} meal 급식 메뉴 데이터
 * @param {number} grade 학년 (1-12)
 * @param {string} userId 사용자 ID
 * @returns {Promise<Object>} 생성된 퀴즈 데이터
 */
const generateQuizWithAI = async function(meal, grade, userId) {
  console.log(`[manual-generate-meal-quiz] ${grade}학년용 퀴즈 생성 시작`);
  console.log(`[DEBUG] 코드 버전: 2025-07-26 수정본 (사용자별 조회)`);
  console.log(`[DEBUG] 사용자 ID: ${userId}, 학년: ${grade}`);
  
  // 사용자별 학교 유형 정보 가져오기
  let schoolType;
  try {
    // 사용자 ID로 school_infos 테이블에서 school_type과 grade 조회
    console.log(`[DEBUG] Supabase 쿼리 시작: user_id로 school_infos 테이블 조회`);
    const { data: schoolInfo, error: schoolInfoError } = await supabaseAdmin
      .from('school_infos')
      .select('school_type, grade')
      .eq('user_id', userId)
      .single();
    
    if (schoolInfoError) {
      console.error(`[DEBUG] Supabase 쿼리 오류:`, schoolInfoError);
    }
    
    console.log(`[DEBUG] 쿼리 결과:`, JSON.stringify(schoolInfo));
    
    if (schoolInfo && schoolInfo.school_type) {
      schoolType = schoolInfo.school_type;
      console.log(`[manual-generate-meal-quiz] 사용자별 학교 정보 찾음: ${schoolType}, 학년: ${schoolInfo.grade}`);
      console.log(`[DEBUG] 학교 유형 설정 완료: ${schoolType}`);
      
      // 전달받은 grade와 DB의 grade가 다른 경우 경고
      if (schoolInfo.grade && schoolInfo.grade !== grade) {
        console.log(`[DEBUG] 경고: 전달받은 학년(${grade})과 DB 학년(${schoolInfo.grade})이 다름`);
      }
    } else {
      // 학교 유형 정보가 없는 경우 - 더 이상 추측하지 않음
      console.log(`[manual-generate-meal-quiz] 사용자 학교 정보 없음, 에러 로깅`);
      console.error(`[manual-generate-meal-quiz] 사용자(${userId})의 학교 정보 조회 실패`);
      console.log(`[DEBUG] 학교 유형 정보 없음, schoolType = undefined로 유지`);
    }
  } catch (error) {
    // 오류 발생 시 더 이상 추측하지 않고 오류만 기록
    console.error(`[manual-generate-meal-quiz] 사용자 학교 정보 조회 오류:`, error);
    console.log(`[DEBUG] 예외 발생, schoolType = undefined로 유지`);
  }
  
  // OpenAI 프롬프트 생성
  console.log(`[DEBUG] generateQuizPrompt 함수 호출 전 schoolType = ${schoolType || '정의되지 않음'}`);
  const prompt = generateQuizPrompt(meal, grade, meal.meal_date, meal.school_code, schoolType);
  console.log(`[DEBUG] 프롬프트 생성 완료, 길이: ${prompt.length}자`);
  console.log(`[DEBUG] 프롬프트 첫 200자:`, prompt.substring(0, 200));
  console.log(`[DEBUG] 프롬프트 마지막 200자:`, prompt.substring(prompt.length - 200));
  
  try {
    console.log(`[manual-generate-meal-quiz] OpenAI API 호출 시작...`);
    console.log(`[DEBUG] OpenAI 호출 전 schoolType = ${schoolType || '정의되지 않음'}`);
    console.log(`[DEBUG] 프롬프트에 포함된 학교 유형: ${schoolType || '없음'}`);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {"role": "system", "content": "당신은 교육적이고 재미있는 퀴즈를 만드는 전문가입니다."},
        {"role": "user", "content": prompt}
      ],
      temperature: 0.9,
      max_tokens: 700,
    });
    
    console.log(`[manual-generate-meal-quiz] OpenAI API 응답 받음`);
    const responseText = completion.choices[0].message.content;
    console.log(`[manual-generate-meal-quiz] GPT 응답 수신: ${responseText.length}자`);
    
    // JSON 형식 추출 ('{...}' 형태의 문자열 찾기)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`[manual-generate-meal-quiz] JSON 형식을 찾을 수 없음`, responseText);
      console.error(`[manual-generate-meal-quiz] JSON 형식을 찾을 수 없음`, responseText);
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
    const quiz = await generateQuizWithAI(meal, grade, userId);
    
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
