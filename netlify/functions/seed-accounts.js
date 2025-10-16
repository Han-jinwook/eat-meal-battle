const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase 환경변수가 설정되지 않았습니다.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// 한국 아이들이 실제로 사용하는 별명 스타일
const KOREAN_NICKNAMES = [
  // 귀여운 별명들
  '콩순이', '토마토', '바나나킹', '딸기공주', '초코파이', '쿠키몬스터', '젤리빈', '마시멜로우',
  '햄스터', '토끼발', '고양이눈', '강아지', '펭귄이', '코알라', '판다곰', '다람쥐',
  
  // 게임/캐릭터 스타일
  '피카츄', '라이츄', '꼬부기', '파이리', '이브이', '뽀로로', '크롱이', '루피',
  '짱구야', '맹구', '유리', '철수', '훈이', '나미', '쵸파', '상디',
  
  // 음식 관련 (급식 앱이니까!)
  '치킨러버', '피자킹', '햄버거', '떡볶이', '순대국밥', '김치찌개', '불고기', '비빔밥',
  '라면왕', '만두', '호떡이', '붕어빵', '타코야키', '초밥이', '우동이', '카레',
  
  // 트렌디한 별명들
  '민트초코', '딸기우유', '바닐라라떼', '아메리카노', '프라푸치노', '스무디', '밀크티', '버블티',
  '무지개', '별빛이', '달빛이', '햇살이', '구름이', '바람이', '파도', '눈꽃이',
  
  // 성격/특징 별명
  '웃음이', '장난꾸러기', '똑똑이', '개구쟁이', '귀염둥이', '말썽이', '천사', '악마',
  '번개', '태풍이', '지진이', '폭풍이', '조용이', '시끄럼이', '빠름이', '느림이'
];

// 학년별 나이 범위 (만 나이)
const AGE_RANGES = {
  1: { min: 6, max: 8 },   // 초1: 만 6-8세
  2: { min: 7, max: 9 },   // 초2: 만 7-9세
  3: { min: 8, max: 10 },  // 초3: 만 8-10세
  4: { min: 9, max: 11 },  // 초4: 만 9-11세
  5: { min: 10, max: 12 }, // 초5: 만 10-12세
  6: { min: 11, max: 13 }, // 초6: 만 11-13세
  7: { min: 12, max: 14 }, // 중1: 만 12-14세
  8: { min: 13, max: 15 }, // 중2: 만 13-15세
  9: { min: 14, max: 16 }, // 중3: 만 14-16세
  10: { min: 15, max: 17 }, // 고1: 만 15-17세
  11: { min: 16, max: 18 }, // 고2: 만 16-18세
  12: { min: 17, max: 19 }  // 고3: 만 17-19세
};

// 랜덤 선택 함수
function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// 랜덤 나이 생성 함수
function getRandomAge(grade) {
  const range = AGE_RANGES[grade] || { min: 6, max: 19 };
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

// 프로필 이미지 생성 함수 (DiceBear API 사용)
function generateProfileImage(nickname, grade) {
  // 학년에 따라 다른 스타일 사용
  const styles = {
    elementary: ['adventurer', 'avataaars', 'big-smile', 'fun-emoji'],
    middle: ['adventurer-neutral', 'avataaars-neutral', 'personas'],
    high: ['personas', 'adventurer-neutral', 'notionists']
  };
  
  let styleCategory = 'elementary';
  if (grade >= 7 && grade <= 9) styleCategory = 'middle';
  if (grade >= 10) styleCategory = 'high';
  
  const availableStyles = styles[styleCategory];
  const selectedStyle = getRandomItem(availableStyles);
  
  // DiceBear API를 사용한 아바타 생성 URL
  const seed = encodeURIComponent(nickname);
  return `https://api.dicebear.com/7.x/${selectedStyle}/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

// 학교 유형 판별 함수
function getSchoolType(schoolName) {
  if (schoolName.includes('초등학교') || schoolName.includes('초')) return 'elementary';
  if (schoolName.includes('중학교') || schoolName.includes('중')) return 'middle';
  if (schoolName.includes('고등학교') || schoolName.includes('고')) return 'high';
  return 'high'; // 기본값
}

// 학교 유형별 학년 범위
function getGradeRange(schoolType) {
  switch (schoolType) {
    case 'elementary': return [1, 2, 3, 4, 5, 6];
    case 'middle': return [7, 8, 9];
    case 'high': return [10, 11, 12];
    default: return [10, 11, 12];
  }
}

// 시뮬레이션 계정 생성 함수
async function createSimulationAccounts() {
  console.log('[seed-accounts] 시뮬레이션 계정 생성 시작');
  
  try {
    // 1. 활성화된 거점 학교 조회
    const { data: activeSchools, error: schoolsError } = await supabaseAdmin
      .from('seed_schools')
      .select('*')
      .eq('is_active', true)
      .order('region', { ascending: true });

    if (schoolsError) {
      console.error('[seed-accounts] 거점 학교 조회 오류:', schoolsError);
      throw new Error('거점 학교 조회에 실패했습니다.');
    }

    if (!activeSchools || activeSchools.length === 0) {
      throw new Error('활성화된 거점 학교가 없습니다.');
    }

    console.log(`[seed-accounts] 활성화된 거점 학교 ${activeSchools.length}개 발견`);

    const createdAccounts = [];
    
    // 2. 각 학교별로 2-3명의 계정 생성
    for (const school of activeSchools) {
      const schoolType = getSchoolType(school.school_name);
      const gradeRange = getGradeRange(schoolType);
      const accountCount = Math.floor(Math.random() * 2) + 2; // 2-3명
      
      console.log(`[seed-accounts] ${school.school_name} (${schoolType}) - ${accountCount}명 생성 예정`);
      
      // 같은 학년으로 통일 (GPT 제안대로)
      const selectedGrade = getRandomItem(gradeRange);
      
      for (let i = 0; i < accountCount; i++) {
        const nickname = getRandomItem(KOREAN_NICKNAMES);
        const email = `sim_${school.school_code.toLowerCase()}_${nickname.toLowerCase()}_${Date.now()}_${i}@simulation.local`;
        const age = getRandomAge(selectedGrade);
        const classNumber = Math.floor(Math.random() * 5) + 1; // 1-5반
        const profileImage = generateProfileImage(nickname, selectedGrade);
        
        // 3. 사용자 계정 생성 (auth.users)
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: 'simulation123!', // 시뮬레이션용 고정 비밀번호
          email_confirm: true,
          user_metadata: {
            nickname: nickname,
            age: age,
            is_simulation: true
          }
        });

        if (authError) {
          console.error(`[seed-accounts] 사용자 생성 실패 (${nickname}):`, authError);
          continue; // 실패해도 다음 계정 계속 생성
        }

        console.log(`[seed-accounts] 사용자 생성 성공: ${nickname} (${authUser.user.id})`);

        // 4. 사용자 프로필 생성 (users 테이블)
        const { error: profileError } = await supabaseAdmin
          .from('users')
          .insert({
            id: authUser.user.id,
            email: email,
            nickname: nickname,
            age: age,
            profile_image: profileImage,
            is_simulation: true,
            created_at: new Date().toISOString()
          });

        if (profileError) {
          console.error(`[seed-accounts] 프로필 생성 실패 (${nickname}):`, profileError);
          // 사용자 삭제 시도
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
          continue;
        }

        // 5. 학교 정보 생성 (school_infos 테이블)
        const { error: schoolInfoError } = await supabaseAdmin
          .from('school_infos')
          .insert({
            user_id: authUser.user.id,
            school_code: school.school_code,
            school_name: school.school_name,
            grade: selectedGrade,
            class_number: classNumber,
            created_at: new Date().toISOString()
          });

        if (schoolInfoError) {
          console.error(`[seed-accounts] 학교 정보 생성 실패 (${nickname}):`, schoolInfoError);
          // 사용자 및 프로필 삭제 시도
          await supabaseAdmin.from('users').delete().eq('id', authUser.user.id);
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
          continue;
        }

        createdAccounts.push({
          id: authUser.user.id,
          nickname: nickname,
          email: email,
          school_name: school.school_name,
          school_code: school.school_code,
          grade: selectedGrade,
          class_number: classNumber,
          age: age
        });

        console.log(`[seed-accounts] 계정 생성 완료: ${nickname} (${school.school_name} ${selectedGrade}학년 ${classNumber}반)`);
      }
    }

    console.log(`[seed-accounts] 시뮬레이션 계정 생성 완료: 총 ${createdAccounts.length}개`);
    
    return {
      success: true,
      message: `시뮬레이션 계정 ${createdAccounts.length}개가 성공적으로 생성되었습니다.`,
      accounts: createdAccounts,
      schools_processed: activeSchools.length
    };

  } catch (error) {
    console.error('[seed-accounts] 시뮬레이션 계정 생성 오류:', error);
    throw error;
  }
}

// Netlify 함수 핸들러
exports.handler = async (event, context) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // POST 요청만 허용
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    console.log('[seed-accounts] Netlify 함수 시작');
    
    const result = await createSimulationAccounts();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('[seed-accounts] Netlify 함수 오류:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || '시뮬레이션 계정 생성 중 오류가 발생했습니다.',
      }),
    };
  }
};
