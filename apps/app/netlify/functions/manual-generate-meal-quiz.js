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
 * 학년에 따른 난이도 및 교육과정 정보 계산 함수
 * @param {number} grade 학년 (1-12)
 * @returns {Object} 난이도 및 교육과정 정보
 */
function calculateEducationalLevel(grade) {
  // 초등학교 (1-6학년)
  if (grade >= 1 && grade <= 6) {
    if (grade <= 2) {
      return {
        difficulty: 1,
        levelText: "초등학교 저학년(1-2학년)",
        educationalContent: "기초 식품군 분류, 간단한 영양 상식, 음식의 색과 모양, 건강한 식습관"
      };
    } else if (grade <= 4) {
      return {
        difficulty: 2,
        levelText: "초등학교 중학년(3-4학년)",
        educationalContent: "기본 영양소(탄수화물, 단백질, 지방), 식품의 종류와 특징, 식사 예절, 건강과 영양"
      };
    } else {
      return {
        difficulty: 3,
        levelText: "초등학교 고학년(5-6학년)",
        educationalContent: "영양소와 건강의 관계, 식품의 원산지, 조리 방법의 특징, 환경과 식생활"
      };
    }
  }
  // 중학교 (7-9학년)
  else if (grade >= 7 && grade <= 9) {
    return {
      difficulty: 4,
      levelText: "중학교 (1-3학년)",
      educationalContent: "영양소의 기능과 대사, 식품 첨가물, 식중독 예방, 전통 식문화, 생애 주기별 영양 관리, 지속가능한 식생활"
    };
  }
  // 고등학교 (10-12학년)
  else {
    return {
      difficulty: 5,
      levelText: "고등학교 (1-3학년)",
      educationalContent: "영양소 대사와 질병 예방, 식품 안전, 영양 정책, 영양학의 기초 원리, 식문화의 세계화, 식량 자원과 환경"
    };
  }
}

/**
 * 급식 메뉴 기반 퀴즈 프롬프트 생성
 * @param {Object} meal 급식 메뉴 정보
 * @param {number} grade 학년 (1-12)
 * @returns {string} OpenAI에 전달할 프롬프트
 */
function generateQuizPrompt(meal, grade) {
  const { levelText, educationalContent } = calculateEducationalLevel(grade);
  
  return `
급식 메뉴: ${meal.menu_items.join(', ')}
영양소 정보: ${meal.ntr_info || '정보 없음'}
원산지 정보: ${meal.origin_info || '정보 없음'}

위 급식 메뉴와 관련된 ${levelText} 학생 수준의 객관식 퀴즈를 생성해주세요.
학년별 교육과정 반영 내용: ${educationalContent}

퀴즈는 급식 메뉴의 식재료, 요리 방법, 영양소, 역사, 문화적 배경 등과 관련된 내용이어야 합니다.
한국 교육과정에 맞는 정확하고 교육적인 내용을 담아야 합니다.

문제와 4개의 선택지, 그리고 정답 번호(1-4)를 JSON 형식으로 제공해주세요.
정답에 대한 교육적인 설명도 함께 제공해주세요.

결과 형식:
{
  "question": "퀴즈 질문",
  "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
  "correct_answer": 1,
  "explanation": "정답과 관련된 교육적 설명"
}
`;
}

/**
 * OpenAI를 사용하여 급식 메뉴 기반 퀴즈 생성
 * @param {Object} meal 급식 메뉴 데이터
 * @param {number} grade 학년 (1-12)
 * @returns {Promise<Object>} 생성된 퀴즈 데이터
 */
async function generateQuizWithAI(meal, grade) {
  console.log(`[manual-generate-meal-quiz] ${grade}학년용 퀴즈 생성 시작`);
  
  // OpenAI 프롬프트 생성
  const prompt = generateQuizPrompt(meal, grade);
  
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
    
    // JSON 형식 추출 ('{...}' 형태의 문자열 찾기)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const quizData = JSON.parse(jsonMatch[0]);
      console.log(`[manual-generate-meal-quiz] 퀴즈 생성 성공: ${quizData.question.substring(0, 30)}...`);
      return quizData;
    }
    
    throw new Error("유효한 JSON 응답을 받지 못했습니다");
  } catch (error) {
    console.error(`[manual-generate-meal-quiz] 퀴즈 생성 중 오류 발생:`, error);
    
    // 오류 발생 시 기본 퀴즈 제공 (실패 시 대비)
    return {
      question: "급식에 자주 등장하는 영양소 중 단백질이 풍부한 식품은 무엇일까요?",
      options: ["사과", "밥", "두부", "오렌지 주스"],
      correct_answer: 3, // 1부터 시작하므로 3번이 두부
      explanation: "두부는 콩으로 만들어지며, 식물성 단백질이 풍부한 대표적인 식품입니다."
    };
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
exports.handler = async function(event, context) {
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
