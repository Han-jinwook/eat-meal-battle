const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const https = require('https');

// Supabase 클라이언트 초기화 - 환경 변수 문제 해결
// 환경 변수 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://jxexfhsqlclckohpvnmg.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// 디버그를 위한 로그 추가
console.log(`Supabase URL: ${supabaseUrl ? supabaseUrl.substring(0, 10) + '...' : 'Not found'}`);
console.log('Supabase Service Key:', supabaseServiceKey ? 'Found' : 'Not found');
console.log('Supabase Anon Key:', supabaseAnonKey ? 'Found' : 'Not found');

// 오류 처리
if (!supabaseUrl) {
  console.error('Supabase URL missing or invalid');
}

if (!supabaseServiceKey) {
  console.error('Supabase service role key missing');
}

// 일반 클라이언트 초기화
let supabase;
// Admin 클라이언트 초기화 (RLS 우회용)
let supabaseAdmin;

try {
  if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } else {
    console.error('Cannot initialize standard Supabase client due to missing credentials');
    supabase = null;
  }
  
  if (supabaseUrl && supabaseServiceKey) {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } else {
    console.error('Cannot initialize Supabase Admin client due to missing credentials');
    supabaseAdmin = null;
  }
  
  console.log('Supabase clients initialized successfully');
} catch (error) {
  console.error('Failed to initialize Supabase clients:', error);
  supabase = null;
  supabaseAdmin = null;
}

// HTTP 요청 함수 (Node.js 환경에서 fetch 대신 사용)
async function fetchWithPromise(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: headers
    };
    
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve(parsedData);
        } catch (e) {
          reject(new Error(`데이터 파싱 오류: ${e.message}`));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// OpenAI 클라이언트 초기화 - 새 SDK 버전 사용
const openaiApiKey = process.env.OPENAI_API_KEY || '';

// 디버그를 위한 로그 추가
console.log('OpenAI API Key:', openaiApiKey ? 'Found' : 'Not found');

// 오류 처리
if (!openaiApiKey) {
  console.error('OpenAI API key missing');
}

// OpenAI API 클라이언트 초기화 (새 버전 방식 사용)
let openai = null;
try {
  openai = new OpenAI({
    apiKey: openaiApiKey
  });
  console.log('OpenAI client initialized successfully');
} catch (error) {
  console.error('OpenAI client initialization failed:', error);
}

// 학년에 따른 난이도 계산 함수 - 정수형 반환 (1: 쉬움, 2: 중간, 3: 어려움)
function calculateDifficulty(grade) {
  if (grade <= 2) return 1; // 1-2학년: 쉬움 (1)
  if (grade <= 4) return 2; // 3-4학년: 중간 (2)
  return 3; // 5-6학년: 어려움 (3)
}

// OpenAI API를 통한 퀘즈 생성 - 새로운 API 형식 적용
async function generateQuizWithAI(meal, grade, difficulty) {
  try {
    if (!openai) {
      console.error('OpenAI client not initialized, returning default quiz');
      return {
        question: `${meal.menu_items[0] || '급식'}에 대한 기본 퀴즈`,
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

    // 메뉴 항목 추출 및 필터링 (null 제거)
    const menuItems = meal.menu_items.filter(item => item && item.trim().length > 0);
    const menuText = menuItems.join(', ');

    if (menuItems.length === 0) {
      console.error('No valid menu items found');
      return {
        question: '오늘의 급식에 대한 기본 퀴즈',
        options: ['선택지 1', '선택지 2', '선택지 3', '선택지 4'],
        answer: 0,
        explanation: '메뉴 정보 없음'
      };
    }

    console.log(`Creating quiz for menu: ${menuText}`);

    // 프롬프트 구성
    const prompt = `오늘의 급식 메뉴는 ${menuText}입니다. 

${difficultyText} 식품영양, 요리, 음식 관련 퀴즈를 하나 만들어주세요. 다지선다형(4개 선택지)으로 만들고, 모든 선택지는 현실적이고 그럴듯하게 만들어주세요. 정답 번호는 0부터 시작하는 인덱스로 제시해주세요(0, 1, 2, 3 중 하나). 문제, 선택지, 정답, 해설을 포함해 JSON 형식으로 작성해주세요. 반드시 다음 JSON 형식에 맞춰 작성해주세요:
{
  "question": "퀴즈 질문",
  "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
  "answer": 정답인덱스(0-3),
  "explanation": "정답 설명"
}`;    

    console.log('Sending prompt to OpenAI...');

    // OpenAI API 호출 - 새 방식 사용
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "다음 형식으로 응답해주세요: {\"question\": \"퀴즈 질문\", \"options\": [\"선택지1\", \"선택지2\", \"선택지3\", \"선택지4\"], \"answer\": 정답인덱스(0-3), \"explanation\": \"정답 설명\"}" },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const responseText = chatCompletion.choices[0].message.content.trim();
    console.log('Received response from OpenAI');

    // JSON 응답 파싱
    try {
      // JSON 부분만 추출 시도
      let jsonText = responseText;
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}');
      
      if (jsonStart >= 0 && jsonEnd >= 0) {
        jsonText = responseText.substring(jsonStart, jsonEnd + 1);
      }
      
      const quizData = JSON.parse(jsonText);
      
      // 유효성 검사
      if (!quizData.question || !Array.isArray(quizData.options) || quizData.options.length !== 4 || 
          typeof quizData.answer !== 'number' || !quizData.explanation) {
        throw new Error('Invalid quiz data format');
      }
      
      console.log('Successfully parsed quiz data');
      return quizData;
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      console.log('Response text:', responseText);
      
      // 기본 퀴즈 반환
      return {
        question: `${menuItems[0] || '급식'}에 관한 퀴즈`,
        options: ['선택지 1', '선택지 2', '선택지 3', '선택지 4'],
        answer: 0,
        explanation: 'AI 응답 파싱 실패'
      };
    }
  } catch (error) {
    console.error('OpenAI API 호출 오류:', error);
    console.error(error.stack);
    // 오류 시 기본 퀴즈 반환
    return {
      question: `${meal.menu_items[0] || '급식'}에 대한 기본 퀴즈`,
      options: ['선택지 1', '선택지 2', '선택지 3', '선택지 4'],
      answer: 0,
      explanation: `OpenAI API 오류: ${error.message}`
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
    
    // 새로운 필드명으로 데이터 매핑
    console.log(`Saving quiz for school ${meal.school_code}, grade ${grade}`);
    
    const insertData = {
      school_code: meal.school_code,
      grade: grade,
      meal_date: meal.meal_date,
      meal_id: meal.id,
      question: quiz.question,
      options: quiz.options,
      correct_answer: quiz.answer, // 수정: answer -> correct_answer 필드 매핑
      explanation: quiz.explanation || '', // 테이블에 explanation 필드 추가
      difficulty: calculateDifficulty(grade)
    };
    
    console.log('Insert data:', JSON.stringify(insertData));
    
    const { data, error } = await supabaseAdmin
      .from('meal_quizzes')
      .insert([insertData])
      .select();

    if (error) {
      console.error("퀴즈 저장 중 오류 발생:", error);
      return false;
    }
    
    console.log(`퀴즈 저장 성공: ${meal.school_code} 학교 ${grade}학년`);
    return true;
  } catch (error) {
    console.error("퀴즈 저장 중 예외 발생:", error);
    return false;
  }
}

// 오늘의 급식 메뉴 조회 - 다중 접근 방식으로 개선
async function fetchTodayMeals() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
  console.log("Fetching meals for date:", today);
  
  // 각 시도마다 다른 접근 방법 사용
  const methods = [
    // 1. supabaseAdmin 클라이언트 사용 (RLS 우회)
    async () => {
      if (!supabaseAdmin) {
        console.log("Method 1 skipped: supabaseAdmin not initialized");
        throw new Error("supabaseAdmin not initialized");
      }
      
      console.log("Method 1: Using supabaseAdmin client");
      const { data, error } = await supabaseAdmin
        .from('meal_menus')
        .select('*')
        .eq('meal_date', today)
        .not('menu_items', 'is', null);
      
      if (error) throw error;
      return data;
    },
    // 2. 일반 supabase 클라이언트 사용 (fallback)
    async () => {
      if (!supabase) {
        console.log("Method 2 skipped: supabase not initialized");
        throw new Error("supabase not initialized");
      }
      
      console.log("Method 2: Using standard supabase client");
      const { data, error } = await supabase
        .from('meal_menus')
        .select('*')
        .eq('meal_date', today)
        .not('menu_items', 'is', null);
      
      if (error) throw error;
      return data;
    },
    // 3. 직접 REST API 호출 시도
    async () => {
      console.log("Method 3: Using direct REST API call");
      const url = `${supabaseUrl}/rest/v1/meal_menus?meal_date=eq.${today}&select=*`;
      const headers = {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      };
      
      try {
        console.log("Trying fetch API first...");
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        return await response.json();
      } catch (fetchError) {
        console.log("Fetch failed, trying fetchWithPromise:", fetchError.message);
        return await fetchWithPromise(url, headers);
      }
    }
  ];
  
  for (let i = 0; i < methods.length; i++) {
    try {
      console.log(`Trying method ${i + 1}...`);
      const data = await methods[i]();
      console.log(`Method ${i + 1} succeeded! Found ${data?.length || 0} meals for today.`);
      return data || [];
    } catch (error) {
      console.error(`Method ${i + 1} failed:`, error.message);
      // 마지막 방법이 아니면 다음 방법 시도
      if (i < methods.length - 1) {
        console.log("Trying next method...");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  console.error("All methods failed to fetch meals");
  return [];
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
          
          // 4. 이미 퀘즈가 있는지 확인 (supabaseAdmin 사용)
          console.log(`Checking for existing quiz for school ${meal.school_code}, grade ${grade}`);
          const { data: existingQuiz, error: quizError } = await supabaseAdmin
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
