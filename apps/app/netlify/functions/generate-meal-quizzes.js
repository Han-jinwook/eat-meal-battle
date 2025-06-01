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

// 학교 정보 조회 함수 - school_infos 테이블에서 school_type 등 정보 가져오기
async function getSchoolInfo(schoolCode) {
  try {
    if (!supabaseAdmin) {
      console.error('Cannot get school info: Supabase Admin client not initialized');
      return { school_type: 'elementary', school_name: '기본학교' };
    }

    const { data, error } = await supabaseAdmin
      .from('school_infos')
      .select('school_type, school_name')
      .eq('school_code', schoolCode)
      .single();
      
    if (error) {
      console.error(`Error fetching school info: ${error.message}`);
      return { school_type: 'elementary', school_name: '기본학교' };
    }

    return data || { school_type: 'elementary', school_name: '기본학교' };
  } catch (error) {
    console.error(`Exception in getSchoolInfo: ${error.message}`);
    return { school_type: 'elementary', school_name: '기본학교' };
  }
}

// 학년 범위 결정 함수 - 학교 유형에 따라 범위 반환
function getGradeRange(schoolType) {
  switch(schoolType) {
    case 'middle': return { min: 1, max: 3 };
    case 'high': return { min: 1, max: 3 };
    default: return { min: 1, max: 6 }; // elementary
  }
}

// 퀴즈 생성이 필요한 학교-학년 조합 가져오기 (오늘 급식이 있는 학교만)
async function getQuizTargets() {
  try {
    // 1. 오늘 급식이 있는 학교 코드 목록 가져오기
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
    const { data: todayMeals, error: mealsError } = await supabaseAdmin
      .from('meal_menus')
      .select('school_code')
      .eq('meal_date', today)
      .not('menu_items', 'is', null);
    
    if (mealsError) {
      console.error('Error fetching today\'s meals:', mealsError.message);
      return [];
    }
    
    if (!todayMeals || todayMeals.length === 0) {
      console.log('No meals found for today in any school');
      return [];
    }
    
    // 급식이 있는 학교 코드 목록 추출
    const schoolsWithMeals = todayMeals.map(meal => meal.school_code);
    console.log(`Found ${schoolsWithMeals.length} schools with meals today`);
    
    // 2. 활성 사용자가 있는 학교-학년 조합 가져오기 (급식이 있는 학교만)
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('school_code, grade')
      .is('is_active', true)
      .not('school_code', 'is', null)
      .not('grade', 'is', null)
      .in('school_code', schoolsWithMeals); // 급식이 있는 학교만 필터링
    
    if (error) {
      console.error('Error fetching active users:', error.message);
      return [];
    }
    
    // 중복 제거를 위해 Set 사용
    const uniqueCombinations = new Set();
    const uniqueTargets = [];
    
    for (const user of data) {
      const key = `${user.school_code}_${user.grade}`;
      if (!uniqueCombinations.has(key)) {
        uniqueCombinations.add(key);
        uniqueTargets.push({
          school_code: user.school_code,
          grade: user.grade
        });
      }
    }
    
    console.log(`Found ${uniqueTargets.length} unique school-grade combinations with active users AND meals`);
    return uniqueTargets;
  } catch (error) {
    console.error('Error in getQuizTargets:', error.message);
    return [];
  }
}

// OpenAI API를 통한 퀘즈 생성 - 학교 유형과 학년을 고려한 버전
async function generateQuizWithAI(meal, grade, schoolInfo) {
  try {
    if (!openai) {
      console.error('OpenAI client not initialized, returning default quiz');
      return {
        question: `${meal.menu_items[0] || '급식'}에 대한 기본 퀴즈`,
        options: ['선택지 1', '선택지 2', '선택지 3', '선택지 4'],
        answer: 1,
        explanation: 'OpenAI 클라이언트 초기화 실패'
      };
    }

    // 학교 유형 및 학년에 따른 텍스트 설정
    const schoolType = schoolInfo.school_type || 'elementary';
    const schoolName = schoolInfo.school_name || '학교';
    
    // 학교 유형 한글 변환
    const schoolTypeKorean = 
      schoolType === 'elementary' ? '초등학교' : 
      schoolType === 'middle' ? '중학교' : '고등학교';
      
    // 학년 표시 텍스트
    const gradeText = `${schoolTypeKorean} ${grade}학년`;

    // 메뉴 항목 추출 및 필터링 (null 제거)
    const menuItems = meal.menu_items.filter(item => item && item.trim().length > 0);
    const menuText = menuItems.join(', ');

    if (menuItems.length === 0) {
      console.error('No valid menu items found');
      return {
        question: '오늘의 급식에 대한 기본 퀴즈',
        options: ['선택지 1', '선택지 2', '선택지 3', '선택지 4'],
        answer: 1,
        explanation: '메뉴 정보 없음'
      };
    }

    console.log(`Creating quiz for menu: ${menuText}`);

    // 프롬프트 구성 - 학교 유형과 학년 반영, 1-4 인덱스 사용
    const prompt = `
한국의 ${schoolTypeKorean} ${grade}학년 학생들을 위한 퀴즈 생성:

학교: ${schoolName} (${schoolTypeKorean} ${grade}학년)
오늘의 급식 메뉴: ${menuText}

위 정보를 바탕으로 다음 조건을 만족하는 퀴즈를 생성해주세요:

1. ${schoolTypeKorean} ${grade}학년 교과 과정 및 지식 수준에 정확히 맞추어 난이도를 조절할 것 (필수)
2. 급식 메뉴와 관련된 식품영양, 요리법, 식재료의 특성, 식문화 등에 대한 내용
3. 재미있고 재치있는 요소가 포함되어 학생들의 흥미를 유발할 것
4. 다지선다형(4개 선택지) 형식으로 구성
5. 정답은 1부터 시작하는 번호(1, 2, 3, 4 중 하나)로 표기할 것
6. 퀴즈 해설은 정확하고 쉽게 이해할 수 있도록 작성할 것

JSON 형식으로 출력해주세요:
{
  "question": "퀴즈 질문",
  "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
  "answer": 정답번호(1-4),
  "explanation": "정답 해설"
}`;

    console.log('Sending prompt to OpenAI...');

    // OpenAI API 호출 - 새 방식 사용
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "다음 형식으로 응답해주세요: {\"question\": \"퀴즈 질문\", \"options\": [\"선택지1\", \"선택지2\", \"선택지3\", \"선택지4\"], \"answer\": 정답번호(1-4), \"explanation\": \"정답 설명\"}" },
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
      
      // 유효성 검사 및 응답 인덱스 확인 (1-4 범위)
      if (!quizData.question || !Array.isArray(quizData.options) || quizData.options.length !== 4 || 
          typeof quizData.answer !== 'number' || !quizData.explanation) {
        throw new Error('Invalid quiz data format');
      }
      
      // answer가 1-4 범위인지 확인 및 조정
      if (quizData.answer < 1 || quizData.answer > 4) {
        console.warn('Answer index out of range (1-4), adjusting:', quizData.answer);
        quizData.answer = Math.max(1, Math.min(4, quizData.answer || 1));
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
        answer: 1,
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

// DB에 퀴즈 저장 - difficulty 필드 제거, correct_answer 1-4 범위 사용
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
      correct_answer: quiz.answer, // 1-4 범위 사용 (OpenAI 응답에서 직접 받음)
      explanation: quiz.explanation || '' // 테이블에 explanation 필드 추가
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
    
    // 2. 사용자가 있는 학교-학년 조합 조회
    console.log('Fetching active users for quiz targeting...');
    const quizTargets = await getQuizTargets();
    
    if (quizTargets.length === 0) {
      console.log('No active users found, skipping quiz generation');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "퀴즈 생성 대상 사용자가 없습니다." })
      };
    }
    
    console.log(`Found ${quizTargets.length} school-grade combinations for quiz generation`);
    let successCount = 0;
    let failCount = 0;
    
    // 3. 배치 처리를 위한 설정
    const BATCH_SIZE = 20;
    const processedTargets = [];
    
    // 타겟 그룹을 배치로 처리
    for (let i = 0; i < quizTargets.length; i += BATCH_SIZE) {
      const batch = quizTargets.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${i/BATCH_SIZE + 1} of ${Math.ceil(quizTargets.length/BATCH_SIZE)}`);
      
      // 각 타겟에 대해 처리
      for (const target of batch) {
        try {
          // 해당 학교의 급식 정보 찾기
          const meal = meals.find(m => m.school_code === target.school_code);
          if (!meal) {
            console.log(`No meal found for school ${target.school_code}, skipping`);
            continue;
          }
          
          // 급식 데이터 검증
          if (!meal.menu_items || !Array.isArray(meal.menu_items) || meal.menu_items.length === 0) {
            console.log(`Skipping meal for school ${target.school_code}: Invalid menu items`);
            continue;
          }
          
          // 이미 처리된 school_code + grade 조합 체크
          const targetKey = `${target.school_code}_${target.grade}`;
          if (processedTargets.includes(targetKey)) {
            console.log(`Already processed ${target.school_code} grade ${target.grade}, skipping`);
            continue;
          }
          processedTargets.push(targetKey);
          
          console.log(`Processing school ${target.school_code}, grade ${target.grade}`);
          
          // 4. 학교 정보 조회
          const schoolInfo = await getSchoolInfo(target.school_code);
          
          // 5. 이미 퀘즈가 있는지 확인 (supabaseAdmin 사용)
          console.log(`Checking for existing quiz for school ${target.school_code}, grade ${target.grade}`);
          const { data: existingQuiz, error: quizError } = await supabaseAdmin
            .from('meal_quizzes')
            .select('id')
            .eq('school_code', target.school_code)
            .eq('grade', target.grade)
            .eq('meal_date', meal.meal_date)
            .limit(1);
          
          if (quizError) {
            console.error(`Error checking existing quiz: ${quizError.message}`);
            failCount++;
            continue;
          }
          
          if (existingQuiz && existingQuiz.length > 0) {
            console.log(`${target.school_code} 학교 ${target.grade}학년 퀘즈가 이미 존재합니다.`);
            continue; // 이미 존재하면 다음으로
          }
          
          // 6. OpenAI API를 통해 퀘즈 생성
          console.log(`Generating quiz with OpenAI for ${schoolInfo.school_type} grade ${target.grade}`);
          const quiz = await generateQuizWithAI(meal, target.grade, schoolInfo);
          
          if (!quiz || !quiz.question || !quiz.options || !Array.isArray(quiz.options)) {
            console.error('Generated quiz is invalid:', quiz);
            failCount++;
            continue;
          }
          
          // 7. 데이터베이스에 저장
          console.log(`Saving quiz to database for school ${target.school_code}, grade ${target.grade}`);
          const saved = await saveQuizToDatabase(quiz, meal, target.grade);
          if (saved) {
            console.log(`Successfully saved quiz for school ${target.school_code}, grade ${target.grade}`);
            successCount++;
          } else {
            console.error(`Failed to save quiz for school ${target.school_code}, grade ${target.grade}`);
            failCount++;
          }
        } catch (targetError) {
          console.error(`Error processing target ${target.school_code}_${target.grade}:`, targetError);
          failCount++;
        }
      }
      
      // 배치 간 짧은 대기 (API 제한 방지)
      if (i + BATCH_SIZE < quizTargets.length) {
        console.log('Waiting between batches...');
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
    console.log(`Quiz generation completed: ${successCount} successful, ${failCount} failed`);
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
