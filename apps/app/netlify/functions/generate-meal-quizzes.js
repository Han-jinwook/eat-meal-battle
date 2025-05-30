const { createClient } = require('@supabase/supabase-js');
const { Configuration, OpenAIApi } = require('openai');

// Supabase 클라이언트 초기화 - 환경 변수 문제 해결
// 환경 변수를 직접 하드코딩하여 테스트
const supabaseUrl = process.env.SUPABASE_URL || 'https://jxexfhsqlclckohpvnmg.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// 디버그를 위한 로그 추가
console.log(`Supabase URL: ${supabaseUrl ? supabaseUrl.substring(0, 10) + '...' : 'Not found'}`);
console.log('Supabase Service Key:', supabaseKey ? 'Found' : 'Not found');

// 오류 처리
if (!supabaseUrl) {
  console.error('Supabase URL missing or invalid');
}

if (!supabaseKey) {
  console.error('Supabase service role key missing');
}

let supabase;
try {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log('Supabase client initialized successfully');
  } else {
    console.error('Cannot initialize Supabase client due to missing credentials');
    supabase = null;
  }
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
  supabase = null;
}

// OpenAI 클라이언트 초기화 - 새로운 방식으로 변경
const openaiApiKey = process.env.OPENAI_API_KEY || '';

// 디버그를 위한 로그 추가
console.log('OpenAI API Key:', openaiApiKey ? 'Found' : 'Not found');

// 오류 처리
if (!openaiApiKey) {
  console.error('OpenAI API key missing');
}

let openai;
try {
  // 최신 OpenAI Node.js SDK 사용 방식
  const { OpenAI } = require('openai');
  
  openai = new OpenAI({
    apiKey: openaiApiKey
  });
  console.log('OpenAI client initialized successfully');
} catch (error) {
  console.error('Failed to initialize OpenAI client:', error);
  openai = null;
}

// 학년에 따른 난이도 계산 함수
function calculateDifficulty(grade) {
  if (grade <= 2) return 'easy'; // 1-2학년: 쉬움
  if (grade <= 4) return 'medium'; // 3-4학년: 중간
  return 'hard'; // 5-6학년: 어려움
}

// OpenAI API를 통한 퀘즈 생성 - 새로운 API 형식 적용
async function generateQuizWithAI(meal, grade, difficulty) {
  try {
    if (!openai) {
      console.error('OpenAI client not initialized, returning default quiz');
      return {
        question: `${meal.menu_items[0] || '급식'}에 대한 기본 퀘즈`,
        options: ['선택지 1', '선택지 2', '선택지 3', '선택지 4'],
        answer: 0,
        explanation: 'OpenAI 클라이언트 초기화 실패'
      };
    }

    // 학년에 따른 난이도 텍스트 설정
    let difficultyText = '';
    if (difficulty === 'easy') {
      difficultyText = '초등학교 저학년 수준의';
    } else if (difficulty === 'medium') {
      difficultyText = '초등학교 중학년 수준의';
    } else {
      difficultyText = '초등학교 고학년 수준의';
    }
    
    console.log(`Generating quiz for ${meal.school_code}, grade ${grade}, difficulty ${difficulty}`);
    console.log(`Menu items: ${meal.menu_items.join(', ') || 'None'}`);    
    
    // 프롬프트 작성
    const prompt = `
급식 메뉴: ${meal.menu_items.join(', ')}
영양소 정보: ${meal.ntr_info || '정보 없음'}
원산지 정보: ${meal.origin_info || '정보 없음'}

위 급식 메뉴와 관련된 ${difficultyText}의 객관식 퀘즈를 생성해주세요.
`;
    
    // 새로운 OpenAI API 호출 방식
    console.log('Calling OpenAI API...');
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "다음 형식으로 응답해주세요: {\"question\": \"...\", \"options\": [\"...\", \"...\", \"...\", \"...\"], \"answer\": 0, \"explanation\": \"...\"}. answer는 0부터 시작하는 인덱스로 정확한 답변의 위치를 지정합니다." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });
    
    // 새로운 형식에 맞게 응답문 파싱
    const responseText = chatCompletion.choices[0].message.content.trim();
    console.log('OpenAI response received');
    
    try {
      // JSON 형식으로 파싱
      const quizData = JSON.parse(responseText);
      console.log('퀘즈 생성 성공:', quizData.question);
      return quizData;
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      console.log('원본 응답:', responseText);
      
      // 정확한 JSON이 아닌 경우, 정규표현식으로 추출 시도
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const extractedJson = jsonMatch[0];
          const parsedData = JSON.parse(extractedJson);
          console.log('정규표현식으로 파싱 성공:', parsedData.question);
          return parsedData;
        }
      } catch (regexError) {
        console.error('정규표현식 추출 실패:', regexError);
      }
      
      // 기본 퀘즈 반환
      return {
        question: `${meal.menu_items[0]}에 대한 퀘즈`,
        options: ['선택지 1', '선택지 2', '선택지 3', '선택지 4'],
        answer: 0,
        explanation: '기본 설명'
      };
    }
  } catch (error) {
    console.error('퀘즈 생성 중 오류:', error);
    console.error('Error details:', error.message);
    // 오류 발생 시 기본 퀘즈 반환
    return {
      question: `${meal.menu_items[0] || '급식'}에 대한 기본 퀘즈`,
      options: ['선택지 1', '선택지 2', '선택지 3', '선택지 4'],
      answer: 0,
      explanation: '오류 발생: ' + error.message
    };
  }
}

// DB에 퀴즈 저장 - 새로운 필드명 대응
async function saveQuizToDatabase(quiz, meal, grade) {
  try {
    if (!supabase) {
      console.error('Cannot save quiz: Supabase client not initialized');
      return false;
    }
    
    console.log('Saving quiz to database with data:', {
      school_code: meal.school_code,
      grade: grade,
      meal_date: meal.meal_date,
      meal_id: meal.id,
      question: quiz.question?.substring(0, 30) + '...' || 'None',
      options_count: quiz.options?.length || 0,
      answer: quiz.answer !== undefined ? quiz.answer : (quiz.correct_answer !== undefined ? quiz.correct_answer : null),
      explanation: quiz.explanation?.substring(0, 30) + '...' || 'None'
    });
    
    // 필드명을 새로운 구조에 맞게 조정 (answer 혹은 correct_answer 중 있는 것 사용)
    const { data, error } = await supabase
      .from('meal_quizzes')
      .insert([{
        school_code: meal.school_code,
        grade: grade,
        meal_date: meal.meal_date,
        meal_id: meal.id,
        question: quiz.question,
        options: quiz.options,
        correct_answer: quiz.answer !== undefined ? quiz.answer : (quiz.correct_answer !== undefined ? quiz.correct_answer : 0),
        explanation: quiz.explanation || '',
        difficulty: calculateDifficulty(grade)
      }])
      .select();

    if (error) {
      console.error("퀘즈 저장 중 오류 발생:", error);
      return false;
    }
    console.log('Quiz saved successfully with ID:', data?.[0]?.id || 'Unknown');
    return true;
  } catch (error) {
    console.error('퀘즈 저장 중 예상치 못한 오류:', error);
    return false;
  }
}

// 오늘의 급식 메뉴 조회 - 오류 처리 강화
async function fetchTodayMeals() {
  try {
    // 테스트를 위해 날짜 출력
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD 형식
    
    console.log('Current time:', now.toISOString());
    console.log('Fetching meals for date:', today);
    
    if (!supabase) {
      console.error('Cannot fetch meals: Supabase client not initialized');
      return [];
    }
    
    // 실제 데이터 조회 전 테이블 존재 확인
    const { data: tablesData, error: tablesError } = await supabase
      .from('meal_menus')
      .select('id')
      .limit(1);
      
    if (tablesError) {
      console.error('Failed to verify meal_menus table:', tablesError);
      return [];
    }
    
    console.log('meal_menus table verified, proceeding to fetch data');
    
    // 오늘의 급식 조회
    const { data, error } = await supabase
      .from('meal_menus')
      .select('*')
      .eq('meal_date', today)
      .not('menu_items', 'is', null);

    if (error) {
      console.error("급식 메뉴 조회 중 오류 발생:", error);
      return [];
    }
    
    console.log(`Found ${data?.length || 0} meals for today`);
    return data || [];
  } catch (error) {
    console.error('급식 조회 중 예상치 못한 오류 발생:', error);
    return [];
  }
}

// 메인 함수
exports.handler = async function(event, context) {
  console.log('Handler function started');
  
  // 클라이언트 초기화 확인
  if (!supabase) {
    console.error('Cannot proceed: Supabase client not initialized');
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Internal Server Error", 
        message: "Supabase client initialization failed" 
      })
    };
  }
  
  if (!openai) {
    console.error('Cannot proceed: OpenAI client not initialized');
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Internal Server Error", 
        message: "OpenAI client initialization failed" 
      })
    };
  }
  
  // 성공적인 update-meals.js 함수처럼 API 키 검증 부분 제거
  console.log('퀘즈 생성 함수 실행 시작');

  try {
    console.log('Starting quiz generation process');
    
    // 1. 오늘 날짜의 급식 메뉴 조회
    console.log('Fetching today\'s meals...');
    const meals = await fetchTodayMeals();
    
    if (meals.length === 0) {
      console.log('No meals found for today');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "오늘의 급식 정보가 없습니다." })
      };
    }
    
    console.log(`Found ${meals.length} meals, starting quiz generation`);
    let successCount = 0;
    let failCount = 0;
    
    // 2. 각 학교별, 학년별로 퀘즈 생성
    for (const meal of meals) {
      console.log(`Processing meal for school ${meal.school_code}, date ${meal.meal_date}`);
      
      // 급식 데이터 검증
      if (!meal.menu_items || !Array.isArray(meal.menu_items) || meal.menu_items.length === 0) {
        console.log(`Skipping meal for school ${meal.school_code}: Invalid menu items`);
        continue;
      }
      
      for (let grade = 1; grade <= 6; grade++) {
        try {
          console.log(`Generating quiz for grade ${grade}`);
          
          // 3. 난이도 설정 (학년에 따라)
          const difficulty = calculateDifficulty(grade);
          
          // 4. 이미 퀘즈가 있는지 확인
          console.log(`Checking for existing quiz for school ${meal.school_code}, grade ${grade}`);
          const { data: existingQuiz, error: quizError } = await supabase
            .from('meal_quizzes')
            .select('id')
            .eq('school_code', meal.school_code)
            .eq('grade', grade)
            .eq('meal_date', meal.meal_date)
            .limit(1);
          
          if (quizError) {
            console.error(`Error checking existing quiz: ${quizError.message}`);
            failCount++;
            continue;
          }
          
          if (existingQuiz && existingQuiz.length > 0) {
            console.log(`${meal.school_code} 학교 ${grade}학년 퀘즈가 이미 존재합니다.`);
            continue; // 이미 존재하면 다음으로
          }
          
          // 5. OpenAI API를 통해 퀘즈 생성
          console.log(`Generating quiz with OpenAI for grade ${grade}`);
          const quiz = await generateQuizWithAI(meal, grade, difficulty);
          
          if (!quiz || !quiz.question || !quiz.options || !Array.isArray(quiz.options)) {
            console.error('Generated quiz is invalid:', quiz);
            failCount++;
            continue;
          }
          
          // 6. 데이터베이스에 저장
          console.log(`Saving quiz to database for school ${meal.school_code}, grade ${grade}`);
          const saved = await saveQuizToDatabase(quiz, meal, grade);
          if (saved) {
            console.log(`Successfully saved quiz for school ${meal.school_code}, grade ${grade}`);
            successCount++;
          } else {
            console.error(`Failed to save quiz for school ${meal.school_code}, grade ${grade}`);
            failCount++;
          }
        } catch (gradeError) {
          console.error(`Error processing grade ${grade}:`, gradeError);
          failCount++;
        }
      }
    }
    
    console.log(`Quiz generation completed: ${successCount} successful, ${failCount} failed`);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "퀘즈 생성 완료",
        stats: {
          totalMeals: meals.length,
          successCount,
          failCount
        }
      })
    };
  } catch (error) {
    console.error("퀘즈 생성 중 오류 발생:", error);
    // 오류 정보를 더 자세히 로깅
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "퀘즈 생성 중 오류가 발생했습니다.",
        details: error.message
      })
    };
  }
};
