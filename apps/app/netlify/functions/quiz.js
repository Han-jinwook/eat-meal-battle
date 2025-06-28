const { createClient } = require('@supabase/supabase-js');

console.log('🔍 환경변수 체크:', {
  SUPABASE_URL: !!process.env.SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
});

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 환경변수 검증
if (!supabaseUrl) {
  const errorMsg = 'SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_URL 환경변수가 설정되지 않았습니다.';
  throw new Error(errorMsg);
}

if (!supabaseServiceKey) {
  const errorMsg = 'SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.';
  throw new Error(errorMsg);
}

const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// 유저 퀴즈 가져오기
async function getUserQuiz(userId, schoolCode, grade, requestedDate) {
  console.log(`getUserQuiz 호출: userId=${userId}, schoolCode=${schoolCode}, grade=${grade}, requestedDate=${requestedDate}`);
  // 유저 학교 정보 확인
  if (!schoolCode || !grade) {
    const { data: userSchool, error: userSchoolError } = await supabaseClient
      .from('school_infos')
      .select('school_code, grade')
      .eq('user_id', userId)
      .single();

    if (userSchoolError) {
      return { error: "사용자의 학교 정보를 찾을 수 없습니다." };
    }
    
    schoolCode = userSchool.school_code;
    grade = userSchool.grade;
  }

  // 날짜 처리
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9 한국 시간
  const currentHour = koreaTime.getUTCHours();
  const currentMinutes = koreaTime.getUTCMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinutes;
  
  // 시간 기준 (한국 시간)
  const showQuizTime = 12 * 60 + 30; // 12:30
  const showAnswerTime = 19 * 60;     // 19:00
  
  const quizDate = requestedDate || koreaTime.toISOString().split('T')[0]; // 기본값은 오늘 날짜
  const isToday = !requestedDate || requestedDate === koreaTime.toISOString().split('T')[0];
  
  console.log(`날짜 처리: requestedDate=${requestedDate}, quizDate=${quizDate}, isToday=${isToday}`);
  
  // 오늘 날짜이고 12:30 이후인지 확인
  const canShowTodayQuiz = !isToday || currentTimeMinutes >= showQuizTime;
  const canShowAnswer = !isToday || currentTimeMinutes >= showAnswerTime;
  
  // 급식 정보 확인
  const { data: mealData, error: mealError } = await supabaseClient
    .from('meal_menus')
    .select('id, menu_items')
    .eq('school_code', schoolCode)
    .eq('meal_date', quizDate)
    .limit(1);
    
  // 급식 정보가 없는 경우 (기본 에러 체크 및 "급식 정보가 없습니다" 텍스트 포함 여부 확인)
  if (mealError || !mealData || mealData.length === 0 || !mealData[0].menu_items ||
      (Array.isArray(mealData[0].menu_items) && mealData[0].menu_items.includes('급식 정보가 없습니다'))) {
    return {
      noMenu: true,
      message: '급식 정보가 없는 날이어서 급식퀴즈도 쉬어가요'
    };
  }
  
  // 해당 날짜의 퀴즈 조회
  console.log(`meal_quizzes 테이블에서 퀴즈 조회: schoolCode=${schoolCode}, grade=${grade}, meal_date=${quizDate}`);
  const { data: dateQuiz, error: dateQuizError } = await supabaseClient
    .from('meal_quizzes')
    .select(`
      id,
      question,
      options,
      correct_answer,
      explanation,
      meal_date,
      meal_id,
      meal_menus(menu_items)
    `)
    .eq('school_code', schoolCode)
    .eq('grade', grade)
    .eq('meal_date', quizDate)
    .limit(1)
    .maybeSingle();
    
  console.log(`퀴즈 조회 결과: 오류=${dateQuizError ? '있음' : '없음'}, 퀴즈 발견=${dateQuiz ? '성공' : '실패'}, 퀴즈ID=${dateQuiz?.id}, 퀴즈날짜=${dateQuiz?.meal_date}`);

  if (!dateQuizError && dateQuiz) {
    // 해당 날짜 퀴즈 찾았음
    return await processQuiz(userId, dateQuiz, canShowAnswer);
  }
  
  // 해당 날짜에 퀴즈가 없음
  return { error: "해당 날짜에 퀴즈가 없습니다." };
}

// 퀴즈 처리 함수 (정답 확인 시간에 따라 정보 제한)
async function processQuiz(userId, quiz, canShowAnswer) {
  // 이미 풀었는지 확인
  const { data: existing, error: existingError } = await supabaseClient
    .from('quiz_results')
    .select('id, is_correct, selected_option')
    .eq('user_id', userId)
    .eq('quiz_id', quiz.id)
    .limit(1);

  // 이미 풀었거나 정답 확인 시간 이후인 경우
  if ((existing && existing.length > 0) || canShowAnswer) {
    return {
      quiz: {
        id: quiz.id,
        question: quiz.question,
        options: quiz.options,
        correct_answer: canShowAnswer ? quiz.correct_answer : undefined, // 7시 이후에만 정답 제공
        explanation: canShowAnswer ? quiz.explanation : undefined,       // 7시 이후에만 해설 제공
        meal_date: quiz.meal_date,
        menu_items: quiz.meal_menus?.menu_items || []
      },
      alreadyAnswered: existing && existing.length > 0,
      isCorrect: existing && existing.length > 0 ? existing[0].is_correct : undefined,
      selectedOption: existing && existing.length > 0 ? existing[0].selected_option : undefined
    };
  }

  // 정답은 반환하지 않음 (정답 확인 시간 이전)
  return {
    quiz: {
      id: quiz.id,
      question: quiz.question,
      options: quiz.options,
      meal_date: quiz.meal_date,
      menu_items: quiz.meal_menus?.menu_items || []
    },
    alreadyAnswered: false
  };
}

// 퀴즈 답변 제출 함수
async function submitQuizAnswer(userId, quizId, selectedOption, answerTime) {
  try {
    // 퀴즈 정보 조회
    const { data: quiz, error: quizError } = await supabaseAdmin
      .from('meal_quizzes')
      .select('*')
      .eq('id', quizId)
      .single();
      
    if (quizError || !quiz) {
      return { error: '퀴즈를 찾을 수 없습니다.' };
    }
    
    // 이미 답변했는지 확인
    const { data: existing } = await supabaseAdmin
      .from('quiz_results')
      .select('id')
      .eq('user_id', userId)
      .eq('quiz_id', quizId)
      .limit(1);
      
    if (existing && existing.length > 0) {
      return { error: '이미 답변한 퀴즈입니다.' };
    }
    
    // 정답 확인 (0-based index)
    const isCorrect = selectedOption === quiz.correct_answer;
    
    // 답변 저장
    const { data: result, error: saveError } = await supabaseAdmin
      .from('quiz_results')
      .insert({
        user_id: userId,
        quiz_id: quizId,
        selected_option: selectedOption,
        is_correct: isCorrect,
        answer_time: answerTime,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
      
    if (saveError) {
      return { error: '답변 저장에 실패했습니다.' };
    }
    
    return {
      success: true,
      isCorrect: isCorrect,
      correctAnswer: quiz.correct_answer,
      explanation: quiz.explanation,
      selectedOption: selectedOption
    };
    
  } catch (error) {
    return { error: '답변 제출 중 오류가 발생했습니다.' };
  }
}

// 장원 목록 가져오기
async function getChampions(schoolCode, grade, month, year) {
  // 현재 월과 연도가 없으면 현재 날짜 사용
  if (!month || !year) {
    const now = new Date();
    month = month || now.getMonth() + 1;
    year = year || now.getFullYear();
  }

  // 장원 목록 조회
  const { data: champions, error } = await supabaseClient
    .from('quiz_champions')
    .select(`
      id,
      user_id,
      correct_count,
      total_count,
      avg_answer_time,
      users:user_id(nickname, avatar_url)
    `)
    .eq('school_code', schoolCode)
    .eq('grade', grade)
    .eq('month', month)
    .eq('year', year)
    .order('correct_count', { ascending: false })
    .order('avg_answer_time', { ascending: true })
    .limit(10);

  if (error) {
    return { error: "장원 목록을 가져오는 중 오류가 발생했습니다." };
  }

  return { champions };
}

// API 핸들러
exports.handler = async function(event, context) {
  console.log('🚀 Quiz API 시작:', event.httpMethod, event.path);
  
  // CORS 헤더
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // OPTIONS 요청 처리
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight response' })
    };
  }

  // 토큰에서 사용자 ID 추출
  let userId;
  try {
    const authHeader = event.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    
    // JWT 토큰 검증 (Supabase 서비스 역할 키 사용)
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    
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

  // 요청 경로와 메서드에 따라 처리
  const path = event.path.replace('/.netlify/functions/quiz', '');
  const pathSegments = path.split('/').filter(segment => segment);
  const method = event.httpMethod;

  try {
    // 쿼리 파라미터 파싱
    const params = event.queryStringParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};

    // GET /quiz - 사용자의 오늘 퀴즈 가져오기
    if (method === 'GET' && (!pathSegments.length || pathSegments[0] === '')) {
      const result = await getUserQuiz(userId, params.school_code, params.grade, params.date);
      
      return {
        statusCode: result.error ? 404 : 200,
        headers,
        body: JSON.stringify(result)
      };
    }
    
    // POST /quiz - 퀴즈 생성
    if (method === 'POST' && (!pathSegments.length || pathSegments[0] === '')) {
      const { school_code, grade, date } = body;
      
      console.log(`POST 요청 받음 - 퀴즈 생성 요청: school_code=${school_code}, grade=${grade}, date=${date}`);
      
      if (!school_code || !grade || !date) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: '학교 코드, 학년, 날짜가 필요합니다.' })
        };
      }
      
      try {
        // 퀴즈 생성 로직을 직접 구현
        // 이미 해당 날짜에 퀴즈가 존재하는지 확인
        console.log(`기존 퀴즈 존재 확인: school_code=${school_code}, grade=${grade}, meal_date=${date}`);
        const { data: existingQuiz } = await supabaseAdmin
          .from('meal_quizzes')
          .select('id, meal_date')
          .eq('school_code', school_code)
          .eq('grade', grade)
          .eq('meal_date', date)
          .limit(1);
          
        console.log(`기존 퀴즈 조회 결과: ${existingQuiz ? '퀴즈 있음' : '퀴즈 없음'}, 퀴즈 개수=${existingQuiz?.length}, 처음 퀴즈 ID=${existingQuiz?.[0]?.id}, 퀴즈 날짜=${existingQuiz?.[0]?.meal_date}`);
          
        if (existingQuiz && existingQuiz.length > 0) {
          // 기존 퀴즈 조회해서 반환
          console.log(`기존 퀴즈 발견, getUserQuiz 호출: userId=${userId}, school_code=${school_code}, grade=${grade}, date=${date}`);
          const result = await getUserQuiz(userId, school_code, grade, date);
          console.log(`기존 퀴즈 반환 결과:`, result);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
          };
        }
        
        // 급식 메뉴 정보 조회
        const { data: mealData, error: mealError } = await supabaseAdmin
          .from('meal_menus')
          .select('*')
          .eq('school_code', school_code)
          .eq('meal_date', date)
          .limit(1);
          
        if (mealError || !mealData || mealData.length === 0 || !mealData[0].menu_items ||
            (Array.isArray(mealData[0].menu_items) && mealData[0].menu_items.includes('급식 정보가 없습니다'))) {
          // 급식 정보가 없는 경우
          const message = '급식 정보가 없는 날이어서 급식퀴즈도 쉬어가요';
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
              noMenu: true,
              message: message,
              date: date
            })
          };
        }
        
        const meal = mealData[0];
        
        // OpenAI 기반 퀴즈 생성 (최대 3회 재시도)
        const { generateQuizWithAI } = require('./manual-generate-meal-quiz');
        
        let generatedQuiz = null;
        let lastError = null;
        const MAX_RETRIES = 3;
        
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            console.log(`[quiz] 퀴즈 생성 시도 ${attempt}/${MAX_RETRIES}`);
            generatedQuiz = await generateQuizWithAI(meal, grade);
            console.log(`[quiz] 퀴즈 생성 성공 (${attempt}번째 시도)`);
            break; // 성공하면 루프 종료
          } catch (error) {
            console.error(`[quiz] 퀴즈 생성 시도 ${attempt} 실패:`, error.message);
            lastError = error;
            
            if (attempt < MAX_RETRIES) {
              console.log(`[quiz] ${1000}ms 후 재시도...`);
              await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기 후 재시도
            }
          }
        }
        
        // 모든 재시도 후에도 실패한 경우
        if (!generatedQuiz) {
          console.error(`[quiz] 모든 시도(${MAX_RETRIES}회) 후 퀴즈 생성 실패`);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
              error: '퀴즈 생성을 실패했습니다. 다시 시도해주세요.',
              details: lastError?.message || '최대 시도 횟수 초과'
            })
          };
        }
        
        // DB에 퀴즈 저장
        const { data: savedQuiz, error: saveError } = await supabaseAdmin
          .from('meal_quizzes')
          .insert({
            school_code: school_code,
            grade: grade,
            meal_date: date,
            meal_id: meal.id,
            question: generatedQuiz.question,
            options: generatedQuiz.options,
            correct_answer: generatedQuiz.correct_answer,
            explanation: generatedQuiz.explanation
          })
          .select()
          .single();

        if (saveError) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '퀴즈를 저장하는 중 오류가 발생했습니다.' })
          };
        }
        
        // 생성 후 퀴즈 조회
        const result = await getUserQuiz(userId, school_code, grade, date);
        
        return {
          statusCode: result.error ? 404 : 200,
          headers,
          body: JSON.stringify(result)
        };
      } catch (error) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: '퀴즈 생성 중 오류가 발생했습니다: ' + error.message })
        };
      }
    }
    
    // POST /quiz/answer - 퀴즈 답변 제출
    if (method === 'POST' && pathSegments[0] === 'answer') {
      const { quiz_id, selected_option, answer_time } = body;
      
      if (!quiz_id || selected_option === undefined || !answer_time) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: '필수 파라미터가 누락되었습니다.' })
        };
      }
      
      const result = await submitQuizAnswer(userId, quiz_id, selected_option, answer_time);
      
      return {
        statusCode: result.error ? 400 : 200,
        headers,
        body: JSON.stringify(result)
      };
    }
    
    // GET /quiz/champions - 장원 목록 가져오기
    if (method === 'GET' && pathSegments[0] === 'champions') {
      if (!params.school_code || !params.grade) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: '학교 코드와 학년이 필요합니다.' })
        };
      }
      
      const result = await getChampions(params.school_code, params.grade, params.month, params.year);
      
      return {
        statusCode: result.error ? 400 : 200,
        headers,
        body: JSON.stringify(result)
      };
    }

    // 지원하지 않는 엔드포인트
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: '요청한 엔드포인트를 찾을 수 없습니다.' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '서버 오류가 발생했습니다.' })
    };
  }
};
