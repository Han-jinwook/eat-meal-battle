// 메뉴별 리얼한 별점 생성 로직

// 메뉴별 기본 선호도 (1-5점, 실제 학생들 선호도 기반)
const MENU_PREFERENCES = {
  // 인기 메뉴들 (4-5점 위주)
  '치킨': { base: 4.5, variance: 0.8 },
  '피자': { base: 4.3, variance: 0.7 },
  '햄버거': { base: 4.2, variance: 0.8 },
  '떡볶이': { base: 4.4, variance: 0.6 },
  '탕수육': { base: 4.1, variance: 0.9 },
  '짜장면': { base: 4.0, variance: 0.8 },
  '짬뽕': { base: 3.8, variance: 1.0 },
  '불고기': { base: 4.2, variance: 0.7 },
  '갈비': { base: 4.3, variance: 0.8 },
  '돈까스': { base: 4.0, variance: 0.9 },
  
  // 보통 메뉴들 (3-4점 위주)
  '비빔밥': { base: 3.5, variance: 0.8 },
  '김치찌개': { base: 3.7, variance: 0.9 },
  '된장찌개': { base: 3.4, variance: 1.0 },
  '미역국': { base: 3.2, variance: 0.8 },
  '콩나물국': { base: 3.1, variance: 0.9 },
  '밥': { base: 3.3, variance: 0.6 },
  '라면': { base: 3.8, variance: 0.8 },
  '우동': { base: 3.6, variance: 0.8 },
  '냉면': { base: 3.5, variance: 1.0 },
  '국수': { base: 3.4, variance: 0.8 },
  
  // 호불호 메뉴들 (2-4점, 분산 큼)
  '김치': { base: 3.0, variance: 1.2 },
  '나물': { base: 2.8, variance: 1.0 },
  '생선': { base: 2.9, variance: 1.3 },
  '두부': { base: 2.7, variance: 1.1 },
  '콩': { base: 2.6, variance: 1.2 },
  '시금치': { base: 2.5, variance: 1.0 },
  '당근': { base: 2.4, variance: 1.1 },
  '브로콜리': { base: 2.3, variance: 1.2 },
  
  // 디저트/간식 (4-5점 위주)
  '과일': { base: 4.1, variance: 0.7 },
  '요구르트': { base: 4.0, variance: 0.8 },
  '아이스크림': { base: 4.6, variance: 0.5 },
  '케이크': { base: 4.4, variance: 0.7 },
  '쿠키': { base: 4.2, variance: 0.8 }
};

// 학년별 선호도 조정 (초등학교는 단순한 맛 선호, 고등학교는 다양한 맛 수용)
const GRADE_ADJUSTMENTS = {
  elementary: {
    sweet_bonus: 0.3,      // 단맛 보너스
    spicy_penalty: -0.4,   // 매운맛 페널티
    vegetable_penalty: -0.5 // 채소 페널티
  },
  middle: {
    sweet_bonus: 0.1,
    spicy_penalty: -0.2,
    vegetable_penalty: -0.3
  },
  high: {
    sweet_bonus: 0.0,
    spicy_penalty: 0.0,
    vegetable_penalty: -0.1
  }
};

// 메뉴 키워드 분류
const MENU_KEYWORDS = {
  sweet: ['케이크', '쿠키', '아이스크림', '과일', '요구르트', '단무지'],
  spicy: ['김치', '떡볶이', '짬뽕', '매운', '고추'],
  vegetable: ['시금치', '당근', '브로콜리', '나물', '콩', '두부', '채소']
};

// 개인별 성향 생성 (각 시뮬레이션 계정마다 고유한 성향)
function generatePersonalPreference(nickname, grade) {
  // 닉네임을 시드로 사용하여 일관된 성향 생성
  const seed = nickname.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = (seed * 9301 + 49297) % 233280; // 간단한 시드 기반 랜덤
  const normalizedRandom = random / 233280;
  
  // 성향 타입 결정 (5가지)
  const personalityTypes = [
    'picky',      // 까다로운 타입 (평균 -0.5)
    'generous',   // 관대한 타입 (평균 +0.3)
    'sweet_lover', // 단맛 선호 (+0.4 to sweet, -0.2 to others)
    'adventurous', // 모험적 타입 (분산 증가)
    'normal'      // 평범한 타입
  ];
  
  const typeIndex = Math.floor(normalizedRandom * personalityTypes.length);
  const personalityType = personalityTypes[typeIndex];
  
  return {
    type: personalityType,
    randomSeed: normalizedRandom
  };
}

// 메뉴에 대한 리얼한 별점 생성
function generateRealisticRating(menuItems, nickname, grade) {
  if (!menuItems || menuItems.length === 0) {
    return Math.floor(Math.random() * 2) + 3; // 3-4점 기본
  }
  
  const personality = generatePersonalPreference(nickname, grade);
  let totalScore = 0;
  let itemCount = 0;
  
  // 학년 그룹 결정
  let gradeGroup = 'elementary';
  if (grade >= 7 && grade <= 9) gradeGroup = 'middle';
  if (grade >= 10) gradeGroup = 'high';
  
  const gradeAdjustment = GRADE_ADJUSTMENTS[gradeGroup];
  
  // 각 메뉴 아이템에 대해 점수 계산
  menuItems.forEach(item => {
    let baseScore = 3.0; // 기본 점수
    let variance = 0.8;   // 기본 분산
    
    // 메뉴 키워드 매칭으로 기본 점수 찾기
    const menuKey = Object.keys(MENU_PREFERENCES).find(key => 
      item.includes(key) || key.includes(item.replace(/\s/g, ''))
    );
    
    if (menuKey) {
      baseScore = MENU_PREFERENCES[menuKey].base;
      variance = MENU_PREFERENCES[menuKey].variance;
    }
    
    // 학년별 조정
    if (MENU_KEYWORDS.sweet.some(keyword => item.includes(keyword))) {
      baseScore += gradeAdjustment.sweet_bonus;
    }
    if (MENU_KEYWORDS.spicy.some(keyword => item.includes(keyword))) {
      baseScore += gradeAdjustment.spicy_penalty;
    }
    if (MENU_KEYWORDS.vegetable.some(keyword => item.includes(keyword))) {
      baseScore += gradeAdjustment.vegetable_penalty;
    }
    
    // 개인 성향 조정
    switch (personality.type) {
      case 'picky':
        baseScore -= 0.5;
        variance *= 0.8;
        break;
      case 'generous':
        baseScore += 0.3;
        variance *= 0.7;
        break;
      case 'sweet_lover':
        if (MENU_KEYWORDS.sweet.some(keyword => item.includes(keyword))) {
          baseScore += 0.4;
        } else {
          baseScore -= 0.2;
        }
        break;
      case 'adventurous':
        variance *= 1.3;
        break;
      default:
        // normal - 변화 없음
        break;
    }
    
    // 가우시안 분포로 최종 점수 생성
    const randomFactor = (personality.randomSeed - 0.5) * 2; // -1 to 1
    const finalScore = baseScore + (randomFactor * variance);
    
    totalScore += Math.max(1, Math.min(5, finalScore));
    itemCount++;
  });
  
  // 평균 계산 후 반올림하여 정수로 변환
  const averageScore = totalScore / itemCount;
  return Math.max(1, Math.min(5, Math.round(averageScore)));
}

// 댓글 생성 함수
function generateRealisticComment(rating, menuItems, nickname, grade) {
  const personality = generatePersonalPreference(nickname, grade);
  
  // 별점대별 댓글 템플릿
  const commentTemplates = {
    5: [
      '오늘 급식 진짜 맛있었어요! 😋',
      '완전 대박! 또 먹고 싶어요 ❤️',
      '우리 학교 급식 최고! 👍',
      '오늘 메뉴 완전 내 스타일이에요!',
      '맛있게 잘 먹었습니다~ 감사해요!'
    ],
    4: [
      '오늘도 맛있었어요! 😊',
      '괜찮네요~ 잘 먹었습니다',
      '맛있어요! 내일도 기대할게요',
      '좋았어요 👍',
      '오늘 급식 만족!'
    ],
    3: [
      '그냥 그래요... 보통이에요',
      '나쁘지 않아요',
      '먹을 만해요',
      '평범한 맛이었어요',
      '그럭저럭 괜찮았어요'
    ],
    2: [
      '음... 별로였어요 😅',
      '좀 아쉬웠어요',
      '다음엔 더 맛있었으면 좋겠어요',
      '입맛에 안 맞았어요 ㅠㅠ',
      '조금 실망했어요'
    ],
    1: [
      '오늘은 정말 별로였어요... 😢',
      '너무 맛없었어요 ㅠㅠ',
      '다음엔 더 신경써주세요',
      '입맛에 전혀 안 맞았어요',
      '개선이 필요할 것 같아요'
    ]
  };
  
  const templates = commentTemplates[rating] || commentTemplates[3];
  const baseComment = templates[Math.floor(Math.random() * templates.length)];
  
  // 성향별 댓글 스타일 조정
  switch (personality.type) {
    case 'picky':
      if (rating >= 4) return baseComment + ' (의외로 괜찮았어요!)';
      if (rating <= 2) return baseComment + ' 다음엔 더 맛있게 해주세요';
      break;
    case 'generous':
      if (rating <= 3) return baseComment.replace(/별로|안/, '그래도 괜찮') + ' 고생하셨어요!';
      break;
    case 'sweet_lover':
      if (menuItems.some(item => MENU_KEYWORDS.sweet.some(keyword => item.includes(keyword)))) {
        return baseComment + ' 달콤해서 좋았어요! 🍰';
      }
      break;
  }
  
  return baseComment;
}

module.exports = {
  generateRealisticRating,
  generateRealisticComment,
  generatePersonalPreference
};
