const { createClient } = require('@supabase/supabase-js');
const { Configuration, OpenAIApi } = require('openai');

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 초기화 정보 로깅
console.log("Supabase URL:", supabaseUrl ? supabaseUrl.substring(0, 8) + '...' : 'Not found');
console.log("Supabase Service Key:", supabaseServiceKey ? 'Found' : 'Not found');

const supabase = createClient(supabaseUrl, supabaseServiceKey);
console.log("Supabase client initialized successfully");

// OpenAI 클라이언트 초기화
const openaiApiKey = process.env.OPENAI_API_KEY;
console.log("OpenAI API Key:", openaiApiKey ? 'Found' : 'Not found');

const configuration = new Configuration({
  apiKey: openaiApiKey,
});
const openai = new OpenAIApi(configuration);
console.log("OpenAI client initialized successfully");

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

// 오늘의 급식 메뉴 조회 (재시도 로직 추가)
async function fetchTodayMeals() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
  console.log("Fetching meals for date:", today);
  
  // 최대 재시도 횟수
  const maxRetries = 3;
  let retries = 0;
  let lastError = null;
  
  while (retries < maxRetries) {
    try {
      // 테이블 접근 가능 여부 먼저 확인
      const { count, error: countError } = await supabase
        .from('meal_menus')
        .select('id', { count: 'exact', head: true });
        
      if (countError) {
        console.error("Failed to verify meal_menus table:", countError);
        throw countError;
      }
      
      console.log(`Successfully connected to meal_menus table. Total records: ${count}`);
      
      // 실제 데이터 조회
      const { data, error } = await supabase
        .from('meal_menus')
        .select('*')
        .eq('meal_date', today)
        .not('menu_items', 'is', null);

      if (error) {
        console.error("Error fetching meals:", error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      lastError = error;
      retries++;
      console.log(`Attempt ${retries}/${maxRetries} failed. Retrying in 1 second...`);
      // 1초 대기 후 재시도
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.error(`Failed to fetch meals after ${maxRetries} attempts. Last error:`, lastError);
  return [];
}

// 메인 함수
exports.handler = async function(event, context) {
  // API 키 검증
  const apiKey = event.headers['x-api-key'] || '';
  if (apiKey !== process.env.CRON_API_KEY) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Unauthorized" })
    };
  }

  try {
    console.log("Handler function started");
    console.log("퀘즈 생성 함수 실행 시작");
    console.log("Starting quiz generation process");
    console.log("Fetching today's meals...");
    console.log("Current time:", new Date().toISOString());
    
    // 1. 오늘 날짜의 급식 메뉴 조회
    const meals = await fetchTodayMeals();
    
    if (meals.length === 0) {
      console.log("No meals found for today");
      // 테이블이 존재하고 접근 가능한지 확인
      try {
        const { count, error } = await supabase
          .from('meal_menus')
          .select('id', { count: 'exact', head: true });
          
        if (error) {
          console.error("Unable to access meal_menus table:", error);
          return {
            statusCode: 500,
            body: JSON.stringify({ 
              message: "데이터베이스 테이블에 접근할 수 없습니다.", 
              error: error.message 
            })
          };
        }
        
        console.log(`meal_menus table is accessible. Total records: ${count}`);
      } catch (err) {
        console.error("Error checking table access:", err);
      }
      
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "오늘의 급식 정보가 없습니다." })
      };
    }
    
    let successCount = 0;
    let failCount = 0;
    
    // 2. 각 학교별, 학년별로 퀴즈 생성
    for (const meal of meals) {
      for (let grade = 1; grade <= 6; grade++) {
        // 3. 난이도 설정 (학년에 따라)
        const difficulty = calculateDifficulty(grade);
        
        // 4. 이미 퀴즈가 있는지 확인
        const { data: existingQuiz } = await supabase
          .from('meal_quizzes')
          .select('id')
          .eq('school_code', meal.school_code)
          .eq('grade', grade)
          .eq('meal_date', meal.meal_date)
          .limit(1);
        
        if (existingQuiz && existingQuiz.length > 0) {
          console.log(`${meal.school_code} 학교 ${grade}학년 퀴즈가 이미 존재합니다.`);
          continue; // 이미 존재하면 다음으로
        }
        
        // 5. OpenAI API를 통해 퀴즈 생성
        const quiz = await generateQuizWithAI(meal, grade, difficulty);
        
        // 6. 데이터베이스에 저장
        const saved = await saveQuizToDatabase(quiz, meal, grade);
        if (saved) {
          successCount++;
        } else {
          failCount++;
        }
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "퀴즈 생성 완료",
        stats: {
          totalMeals: meals.length,
          successCount,
          failCount
        }
      })
    };
  } catch (error) {
    console.error("퀴즈 생성 중 오류 발생:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "퀴즈 생성 중 오류가 발생했습니다." })
    };
  }
};
