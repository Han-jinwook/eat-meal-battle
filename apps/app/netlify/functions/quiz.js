const { createClient } = require('@supabase/supabase-js');

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
    
  if (dateQuizError) {
    return { error: "해당 날짜에 퀴즈를 가져오는 중 오류가 발생했습니다." };
  }

  if (!dateQuiz) {
    // 해당 날짜에 퀴즈가 없음
    return { quiz: null };
  }
  
  // 해당 날짜 퀴즈 찾았음
  return await processQuiz(userId, dateQuiz, canShowAnswer);
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
async function submitQuizAnswer(userId, quizId, selectedOption) {
  console.log('[quiz] submitQuizAnswer 시작:', { userId, quizId, selectedOption });
  
  try {
    // 퀴즈 정보 조회
    console.log('[quiz] 퀴즈 정보 조회 중...', { quizId });
    const { data: quiz, error: quizError } = await supabaseAdmin
      .from('meal_quizzes')
      .select('*')
      .eq('id', quizId)
      .single();
      
    console.log('[quiz] 퀴즈 조회 결과:', { quiz: quiz ? 'found' : 'not found', quizError });
    if (quizError || !quiz) {
      console.log('[quiz] 퀴즈 조회 실패:', quizError);
      return { error: '퀴즈를 찾을 수 없습니다.' };
    }
    
    // 이미 답변했는지 확인
    console.log('[quiz] 기존 답변 확인 중...', { userId, quizId });
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('quiz_results')
      .select('id')
      .eq('user_id', userId)
      .eq('quiz_id', quizId)
      .limit(1);
      
    console.log('[quiz] 기존 답변 확인 결과:', { existing, existingError });
    if (existing && existing.length > 0) {
      console.log('[quiz] 이미 답변한 퀴즈');
      return { error: '이미 답변한 퀴즈입니다.' };
    }
    
    // 정답 확인 (0-based index)
    const isCorrect = selectedOption === quiz.correct_answer;
    console.log('[quiz] 정답 확인:', { selectedOption, correctAnswer: quiz.correct_answer, isCorrect });
    
    // 답변 저장 데이터 준비
    const insertData = {
      user_id: userId,
      quiz_id: quizId,
      selected_option: selectedOption,
      is_correct: isCorrect,
      created_at: new Date().toISOString()
    };
    console.log('[quiz] 저장할 데이터:', insertData);
    
    // 답변 저장
    console.log('[quiz] quiz_results 테이블에 저장 시도...');
    const { data: result, error: saveError } = await supabaseAdmin
      .from('quiz_results')
      .insert(insertData)
      .select()
      .single();
      
    console.log('[quiz] 저장 결과:', { result, saveError });
    if (saveError) {
      console.log('[quiz] 저장 실패 상세:', {
        code: saveError.code,
        message: saveError.message,
        details: saveError.details,
        hint: saveError.hint
      });
      return { error: '답변 저장에 실패했습니다.' };
    }
    
    // 퀴즈 날짜 기반으로 월, 연도, 주차, 일별 계산
    const quizDate = new Date(quiz.meal_date);
    const month = quizDate.getMonth() + 1; // JavaScript의 월은 0부터 시작하므로 +1
    const year = quizDate.getFullYear();
    
    // ISO 주차 계산 (월요일 기준)
    function getISOWeek(date) {
      const target = new Date(date.valueOf());
      const dayNr = (date.getDay() + 6) % 7;
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = target.valueOf();
      target.setMonth(0, 1);
      if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
      }
      return 1 + Math.ceil((firstThursday - target) / 604800000);
    }
    
    // 월 내 주차 계산 (1-6)
    function getWeekOfMonth(date) {
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
      const firstMonday = new Date(firstDay);
      const dayOfWeek = firstDay.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      firstMonday.setDate(firstDay.getDate() - daysToMonday);
      
      const diffTime = date.getTime() - firstMonday.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return Math.min(Math.floor(diffDays / 7) + 1, 6);
    }
    
    // 일별 필드 계산 (day_1 ~ day_6)
    function getDayField(date) {
      const dayOfWeek = date.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
      if (dayOfWeek === 0) return 'day_6'; // 일요일 → day_6
      return `day_${dayOfWeek}`; // 월요일=day_1, 화요일=day_2, ..., 토요일=day_6
    }
    
    const weekOfMonth = getWeekOfMonth(quizDate);
    const dayField = getDayField(quizDate);
    const resultValue = isCorrect ? 'O' : 'X';
    
    console.log('[quiz] 집계 처리:', { 
      month, year, 
      quiz_date: quiz.meal_date, 
      weekOfMonth, 
      dayField, 
      resultValue 
    });
    
    // 장원 테이블 업데이트 (없으면 생성)
    console.log('[quiz] quiz_champions 업데이트 시작:', {
      userId,
      month,
      year,
      dayField,
      resultValue,
      isCorrect
    });
    
    const { data: champion, error: championError } = await supabaseAdmin
      .from('quiz_champions')
      .select('id, month_correct, total_count')
      .eq('user_id', userId)
      .eq('month', month)
      .eq('year', year)
      .limit(1);
    
    console.log('[quiz] quiz_champions 조회 결과:', { champion, championError });
    
    if (championError) {
      console.error('[quiz] quiz_champions 조회 오류:', championError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'quiz_champions 조회 실패' })
      };
    }
    
    if (champion && champion.length > 0) {
      // 기존 기록 업데이트 (기본 필드 + 일별 기록만)
      const currentRecord = champion[0];
      
      const updateData = {
        month_correct: currentRecord.month_correct + (isCorrect ? 1 : 0),
        total_count: currentRecord.total_count + 1,
        [dayField]: resultValue,
        updated_at: new Date().toISOString()
      };
      
      console.log('[quiz] 기존 레코드 업데이트:', { currentRecord, updateData });
      
      const { data: updateResult, error: updateError } = await supabaseAdmin
        .from('quiz_champions')
        .update(updateData)
        .eq('id', currentRecord.id)
        .select();
    
      if (updateError) {
        console.error('[quiz] 장원 기록 업데이트 실패:', updateError);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: '장원 기록 업데이트 실패' })
        };
      } else {
        console.log('[quiz] 장원 기록 업데이트 성공:', updateResult);
      }
    } else {
      // 새 기록 생성 (기본 필드 + 일별 기록만)
      const insertData = {
        user_id: userId,
        month: month,
        year: year,
        month_correct: isCorrect ? 1 : 0,
        total_count: 1,
        [dayField]: resultValue,
        created_at: new Date().toISOString()
      };
      
      console.log('[quiz] 새 레코드 생성:', insertData);
      
      const { data: insertResult, error: insertError } = await supabaseAdmin
        .from('quiz_champions')
        .insert([insertData])
        .select();
    
      if (insertError) {
        console.error('[quiz] 장원 기록 생성 실패:', insertError);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: '장원 기록 생성 실패' })
        };
      } else {
        console.log('[quiz] 장원 기록 생성 성공:', insertResult);
      }
    }
    
    // 주차별, 월별 정답수 업데이트 (직접 처리)
    if (isCorrect) {
      try {
        const weekField = `week_${weekOfMonth}_correct`;
        
        // 기존 quiz_champions 레코드에서 현재 값 조회
        const { data: currentData, error: selectError } = await supabaseAdmin
          .from('quiz_champions')
          .select(`${weekField}, month_correct`)
          .eq('user_id', userId)
          .eq('month', month)
          .eq('year', year)
          .single();
        
        if (!selectError && currentData) {
          // 기존 레코드 업데이트
          const { error: updateError } = await supabaseAdmin
            .from('quiz_champions')
            .update({
              [weekField]: (currentData[weekField] || 0) + 1,
              month_correct: (currentData.month_correct || 0) + 1
            })
            .eq('user_id', userId)
            .eq('month', month)
            .eq('year', year);
          
          if (updateError) {
            console.error('[quiz] 주차별/월별 업데이트 오류:', updateError);
          } else {
            console.log('[quiz] 주차별/월별 정답수 업데이트 완료');
          }
        } else {
          console.log('[quiz] quiz_champions 레코드가 아직 없음, 주차별/월별 업데이트 스킵');
        }
      } catch (directError) {
        console.error('[quiz] 주차별/월별 직접 업데이트 오류:', directError);
      }
    }
    
    console.log('[quiz] submitQuizAnswer 성공!');
    return {
      success: true,
      isCorrect: isCorrect,
      correctAnswer: quiz.correct_answer,
      explanation: quiz.explanation,
      selectedOption: selectedOption
    };
    
  } catch (error) {
    console.log('[quiz] submitQuizAnswer 예외 발생:', error);
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
      users:user_id(nickname, avatar_url)
    `)
    .eq('school_code', schoolCode)
    .eq('grade', grade)
    .eq('month', month)
    .eq('year', year)
    .order('correct_count', { ascending: false })
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
    
    // POST /quiz - 퀴즈 생성
    if (method === 'POST' && (!pathSegments.length || pathSegments[0] === '')) {
      const { school_code, grade, date } = body;
      
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
        const { data: existingQuiz } = await supabaseAdmin
          .from('meal_quizzes')
          .select('id, meal_date')
          .eq('school_code', school_code)
          .eq('grade', grade)
          .eq('meal_date', date)
          .limit(1);
          
        if (existingQuiz && existingQuiz.length > 0) {
          // 기존 퀴즈 조회해서 반환
          const result = await getUserQuiz(userId, school_code, grade, date);
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
            generatedQuiz = await generateQuizWithAI(meal, grade);
            break; // 성공하면 루프 종료
          } catch (error) {
            console.error(`[quiz] 퀴즈 생성 시도 ${attempt} 실패:`, error.message);
            lastError = error;
            
            if (attempt < MAX_RETRIES) {
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
      // 디버깅 로그 - 서버가 받은 요청 정보 출력
      console.log('[quiz] POST /quiz/answer 요청 받음');
      console.log('[quiz] 받은 요청 정보:', {
        method,
        path: event.path,
        pathSegments,
        headers: event.headers,
        body: event.body,
        userId
      });
      
      const { quiz_id, selected_option } = body;
      
      // 디버깅 로그 - 파싱된 파라미터 확인
      console.log('[quiz] 파싱된 파라미터:', {
        quiz_id,
        selected_option,
        quiz_id_type: typeof quiz_id,
        selected_option_type: typeof selected_option
      });
      
      if (!quiz_id || selected_option === undefined) {
        // 디버깅 로그 - 파라미터 검증 실패 원인 로그
        console.log('[quiz] 필수 파라미터 누락:', {
          quiz_id_missing: !quiz_id,
          selected_option_missing: selected_option === undefined
        });
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: '필수 파라미터가 누락되었습니다.' })
        };
      }
      
      console.log('[quiz] submitQuizAnswer 호출 전 - 파라미터 검증 완료');
      console.log('[quiz] 함수 호출 파라미터:', { userId, quiz_id, selected_option });
      
      let result;
      try {
        console.log('[quiz] submitQuizAnswer 함수 호출 시작...');
        result = await submitQuizAnswer(userId, quiz_id, selected_option);
        console.log('[quiz] submitQuizAnswer 함수 호출 완료, 결과:', result);
      } catch (error) {
        console.error('[quiz] submitQuizAnswer 함수 호출 중 예외 발생:', error);
        console.error('[quiz] 예외 스택:', error.stack);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: '퀴즈 답안 제출 중 오류가 발생했습니다.', details: error.message })
        };
      }
      
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
