const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

// 유저 퀴즈 가져오기
async function getUserQuiz(userId, schoolCode, grade, date) {
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
  
  const quizDate = date || koreaTime.toISOString().split('T')[0]; // 기본값은 오늘 날짜
  const isToday = !date || date === koreaTime.toISOString().split('T')[0];
  
  // 오늘 날짜이고 12:30 이후인지 확인
  const canShowTodayQuiz = !isToday || currentTimeMinutes >= showQuizTime;
  const canShowAnswer = !isToday || currentTimeMinutes >= showAnswerTime;
  
  // 퀴즈 가져오기 (시간 제한에 따라 다릅게 처리)
  let quizQuery = supabaseClient
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
    .eq('grade', grade);
  
  if (canShowTodayQuiz) {
    // 12:30 이후면 해당 날짜 퀴즈 가져오기 시도
    const { data: todayQuiz, error: todayQuizError } = await quizQuery
      .eq('meal_date', quizDate)
      .limit(1)
      .maybeSingle(); // 없을 수도 있으므로 maybeSingle 사용

    if (!todayQuizError && todayQuiz) {
      // 오늘 퀴즈 찾았음
      return await processQuiz(userId, todayQuiz, canShowAnswer);
    }
  }
  
  // 오늘 퀴즈가 없거나 12:30 이전이면 가장 최근 퀴즈 가져오기
  const { data: latestQuiz, error: latestQuizError } = await supabaseClient
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
    .order('meal_date', { ascending: false })
    .limit(1)
    .single();

  if (latestQuizError) {
    return { error: "퀴즈가 존재하지 않습니다." };
  }
  
  return await processQuiz(userId, latestQuiz, true); // 이전 퀴즈는 항상 정답 볼 수 있음
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

// 퀴즈 답안 제출
async function submitQuizAnswer(userId, quizId, selectedOption, answerTime) {
  // 퀴즈 정보 가져오기
  const { data: quiz, error: quizError } = await supabaseClient
    .from('meal_quizzes')
    .select('correct_answer, school_code, grade, explanation')
    .eq('id', quizId)
    .single();

  if (quizError) {
    return { error: "퀴즈를 찾을 수 없습니다." };
  }

  // 정답 여부 확인
  const isCorrect = selectedOption === quiz.correct_answer;

  // 결과 저장
  const { data: result, error: resultError } = await supabaseClient
    .from('quiz_results')
    .insert([{
      user_id: userId,
      quiz_id: quizId,
      is_correct: isCorrect,
      selected_option: selectedOption,
      answer_time: answerTime
    }])
    .select();

  if (resultError) {
    // 이미 제출한 경우 처리
    if (resultError.code === '23505') { // 중복 키 제약 조건 위반
      return { error: "이미 답변을 제출했습니다." };
    }
    return { error: "결과 저장 중 오류가 발생했습니다." };
  }

  // 현재 월과 연도
  const now = new Date();
  const month = now.getMonth() + 1; // JavaScript의 월은 0부터 시작하므로 +1
  const year = now.getFullYear();

  // 장원 테이블 업데이트 (없으면 생성)
  const { data: champion, error: championError } = await supabaseClient
    .from('quiz_champions')
    .select('id, correct_count, total_count')
    .eq('user_id', userId)
    .eq('month', month)
    .eq('year', year)
    .limit(1);

  if (champion && champion.length > 0) {
    // 기존 기록 업데이트
    const { error: updateError } = await supabaseClient
      .from('quiz_champions')
      .update({
        correct_count: champion[0].correct_count + (isCorrect ? 1 : 0),
        total_count: champion[0].total_count + 1
      })
      .eq('id', champion[0].id);

    if (updateError) {
      console.error("장원 기록 업데이트 중 오류:", updateError);
    }
  } else {
    // 새 기록 생성
    const { error: insertError } = await supabaseClient
      .from('quiz_champions')
      .insert([{
        user_id: userId,
        month: month,
        year: year,
        correct_count: isCorrect ? 1 : 0,
        total_count: 1,
        is_finalized: false
      }]);

    if (insertError) {
      console.error("장원 기록 생성 중 오류:", insertError);
    }
  }

  // 결과 반환
  return {
    isCorrect,
    correctAnswer: quiz.correct_answer,
    message: isCorrect ? "정답입니다!" : "틀렸습니다."
  };
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
    
    // POST /quiz/answer - 퀴즈 답변 제출
    if (method === 'POST' && pathSegments[0] === 'answer') {
      // 디버깅: 받은 데이터 확인
      console.log('🔍 서버 - 받은 요청 정보:', {
        method: method,
        pathSegments: pathSegments,
        body: body,
        bodyType: typeof body,
        bodyString: event.body
      });
      
      const { quiz_id, selected_option, answer_time } = body;
      
      // 디버깅: 파싱된 파라미터 확인
      console.log('📥 서버 - 파싱된 파라미터:', {
        quiz_id: quiz_id,
        selected_option: selected_option,
        answer_time: answer_time,
        quiz_id_type: typeof quiz_id,
        selected_option_type: typeof selected_option,
        answer_time_type: typeof answer_time
      });
      
      if (!quiz_id || selected_option === undefined || !answer_time) {
        console.log('❌ 서버 - 파라미터 검증 실패:', {
          quiz_id_check: !quiz_id,
          selected_option_check: selected_option === undefined,
          answer_time_check: !answer_time
        });
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
    console.error('API 오류:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '서버 오류가 발생했습니다.' })
    };
  }
};
