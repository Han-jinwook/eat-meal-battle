const { createClient } = require('@supabase/supabase-js');
const { Configuration, OpenAIApi } = require('openai');

// Supabase 클라이언트 초기화 - 오류 처리 강화
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// 디버그를 위한 로그 추가
console.log('Supabase URL:', supabaseUrl ? 'Found' : 'Not found');
console.log('Supabase Service Key:', supabaseServiceKey ? 'Found' : 'Not found');

// 오류 처리
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase credentials missing');
}

// 안전한 초기화
let supabase;
try {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  console.log('Supabase client initialized successfully');
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
  supabase = null;
}

// OpenAI 클라이언트 초기화 - 오류 처리 강화
const openaiApiKey = process.env.OPENAI_API_KEY || '';

// 디버그를 위한 로그 추가
console.log('OpenAI API Key:', openaiApiKey ? 'Found' : 'Not found');

// 오류 처리
if (!openaiApiKey) {
  console.error('OpenAI API key missing');
}

let configuration, openai;
try {
  configuration = new Configuration({
    apiKey: openaiApiKey,
  });
  openai = new OpenAIApi(configuration);
  console.log('OpenAI client initialized successfully');
} catch (error) {
  console.error('Failed to initialize OpenAI client:', error);
  openai = null;
}

// 학년에 따른 난이도 계산 함수
function calculateDifficulty(grade) {
  if (grade <= 2) return 1; // 1-2학년: 쉬움
  if (grade <= 4) return 2; // 3-4학년: 중간
  return 3; // 5-6학년: 어려움
}

// 급식 메뉴 기반 퀴즈 생성 함수
async function generateQuizWithAI(meal, grade, difficulty) {
  // 난이도별 프롬프트 조정
  let difficultyText = "";
  if (difficulty === 1) {
    difficultyText = "매우 쉬운 초등학교 1-2학년 수준";
  } else if (difficulty === 2) {
    difficultyText = "보통 난이도의 초등학교 3-4학년 수준";
  } else {
    difficultyText = "약간 어려운 초등학교 5-6학년 수준";
  }
  
  // OpenAI 프롬프트 구성
  const prompt = `
급식 메뉴: ${meal.menu_items.join(', ')}
영양소 정보: ${meal.ntr_info || '정보 없음'}
원산지 정보: ${meal.origin_info || '정보 없음'}

위 급식 메뉴와 관련된 ${difficultyText}의 객관식 퀴즈를 생성해주세요.
퀴즈는 음식, 영양소, 식재료, 요리 방법 등과 관련된 내용이어야 합니다.
문제와 4개의 선택지, 그리고 정답 번호(0-3)를 JSON 형식으로 제공해주세요.

결과 형식:
{
  "question": "퀴즈 질문",
  "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
  "correct_answer": 0
}
`;

  // OpenAI API 호출
  const response = await openai.createChatCompletion({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "당신은 교육적인 퀴즈를 생성하는 도우미입니다." },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
  });

  // 응답 파싱
  try {
    const content = response.data.choices[0].message.content;
    // JSON 형식 추출 ('{...}' 형태의 문자열 찾기)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("유효한 JSON 응답을 받지 못했습니다");
  } catch (error) {
    console.error("퀴즈 생성 중 오류 발생:", error);
    // 오류 발생 시 기본 퀴즈 제공
    return {
      question: `${meal.menu_items[0]}에 대한 다음 설명 중 옳은 것은?`,
      options: [
        "비타민 C가 풍부하다",
        "단백질이 풍부하다",
        "칼슘이 풍부하다",
        "철분이 풍부하다"
      ],
      correct_answer: 0
    };
  }
}

// DB에 퀴즈 저장
async function saveQuizToDatabase(quiz, meal, grade) {
  const { data, error } = await supabase
    .from('meal_quizzes')
    .insert([{
      school_code: meal.school_code,
      grade: grade,
      meal_date: meal.meal_date,
      meal_id: meal.id,
      question: quiz.question,
      options: quiz.options,
      correct_answer: quiz.correct_answer,
      difficulty: calculateDifficulty(grade)
    }])
    .select();

  if (error) {
    console.error("퀴즈 저장 중 오류 발생:", error);
    return false;
  }
  return true;
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
  
  // API 키 검증
  const apiKey = event.headers ? (event.headers['x-api-key'] || '') : '';
  const cronApiKey = process.env.CRON_API_KEY || '';
  
  console.log('CRON API Key:', cronApiKey ? 'Found' : 'Not found');
  console.log('Request API Key:', apiKey ? 'Provided' : 'Not provided');
  
  if (!cronApiKey || apiKey !== cronApiKey) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Unauthorized", message: "Invalid or missing API key" })
    };
  }

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
