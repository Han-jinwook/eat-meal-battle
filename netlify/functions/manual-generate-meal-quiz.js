const { createClient } = require('@supabase/supabase-js');
const { Configuration, OpenAIApi } = require('openai');

// 환경 변수에서 값 가져오기
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Supabase Admin 클라이언트 초기화 (RLS 우회용)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// OpenAI 클라이언트 초기화
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);



/**
 * 급식 메뉴 기반 퀴즈 프롬프트 생성
 * @param {Object} meal 급식 메뉴 정보
 * @param {number} grade 학년 (1-12)
 * @param {string} mealDate 급식 날짜 (YYYY-MM-DD)
 * @returns {string} OpenAI에 전달할 프롬프트
 */
function generateQuizPrompt(meal, grade, mealDate) {
  return `
급식 메뉴: ${meal.menu_items.join(', ')}
영양소 정보: ${meal.ntr_info || '정보 없음'}
원산지 정보: ${meal.origin_info || '정보 없음'}
메뉴 제공 날짜: ${mealDate}
대상 학년: ${grade}학년

위 정보로 재미있고 트렌디한 객관식 퀴즈 생성:

퀴즈 스타일:
• 재미있고 위트 있는 문체 사용
• 아이들이 좋아하는 트렌드/번어체/유행어 활용
• 이모지나 의성어 사용 가능 (하지만 과하지 않게)
• 일상에서 쓸 수 있는 실용적 내용
• 호기심을 자극하는 스토리텔링

한국 교육과정 기반 학년별 차등화:
• 초등 1-2학년: 기초 식품군, 색깔별 영양, 간단한 식습관 (통합교과 연계)
• 초등 3-4학년: 기본 영양소, 식품 분류, 건강한 식사 (과학, 사회 연계)
• 초등 5-6학년: 영양소 기능, 식품 안전, 전통 음식 (과학, 사회, 실과 연계)
• 중학교 1-3학년: 영양소 대사, 식품 첨가물, 식문화 비교 (과학, 사회, 기술가정 연계)
• 고등학교 1-3학년: 영양 생화학, 식품 정책, 글로벌 식문화 (생명과학, 사회문화 연계)

질문 유형 (다양하게 선택):
• 식재료/영양소 기능과 건강 효과
• 조리법 비교와 영양학적 차이점
• 식문화/전통음식의 역사적 배경
• 지역 특산물과 원산지 특성
• 친환경/지속가능한 식생활
• 계절별 식단과 영양 관리
• 교과서 연계 실험/탐구 활동

필수 조건:
- 암기보다 사고력/응용력 중심
- 오답도 그럴듯하게 구성하여 변별력 확보
- 정답 해설에 추가 학습 내용 포함
- 실생활 적용 가능한 실용적 지식
- 재미있고 기억에 남는 스타일

예시 문체:
- "오늘 급식 메뉴를 보니 완전 대박이네요! 혹시..."
- "이 음식의 숨겨진 비밀은 무엇일까요?"
- "요즘 대세인 건강 만들기의 핵심은?"
- "이 음식이 인기 많은 이유는 바로..."

JSON:
{
  "question": "문제",
  "options": ["1", "2", "3", "4"],
  "correct_answer": 1,
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
async function generateQuizWithAI(meal, grade) {
  console.log(`[manual-generate-meal-quiz] ${grade}학년용 퀴즈 생성 시작`);
  
  // OpenAI 프롬프트 생성
  const prompt = generateQuizPrompt(meal, grade, meal.meal_date);
  
  try {
    // OpenAI API 호출
    const response = await openai.createChatCompletion({
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
    const content = response.data.choices[0].message.content;
    
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
    const { school_code, grade, meal_date, meal_id } = JSON.parse(event.body || '{}');
    
    // 필수 파라미터 검증
    if (!school_code || !grade || !meal_date || !meal_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: '필수 매개변수가 누락되었습니다.', 
          required: ['school_code', 'grade', 'meal_date', 'meal_id'] 
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
      .eq('meal_date', meal_date)
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
    
    // 급식 메뉴 정보 조회
    const { data: meal, error: mealError } = await supabaseAdmin
      .from('meal_menus')
      .select('*')
      .eq('id', meal_id)
      .eq('school_code', school_code)
      .eq('meal_date', meal_date)
      .single();
      
    if (mealError || !meal) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          error: '해당 급식 정보를 찾을 수 없습니다.',
          details: mealError?.message
        })
      };
    }
    
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
          meal_date: meal_date,
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
