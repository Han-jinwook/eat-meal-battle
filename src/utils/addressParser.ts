/**
 * 주소에서 급식 배틀용 지역명을 추출하는 유틸리티
 * 
 * 규칙:
 * - 광역시/특별시: 구 단위로 구분 (예: "인천 서구", "서울 강남구")
 * - 도 지역: 시/군 단위로 구분 (예: "안산시", "횡성군")
 */

interface RegionInfo {
  region: string;
  level: 'district' | 'city' | 'county';
  fullAddress: string;
}

/**
 * 주소에서 급식 배틀용 지역명을 추출
 */
export function extractBattleRegion(address: string): string {
  if (!address) return '지역 정보 없음';
  
  // 주소 정규화 (공백 제거 및 통일)
  const normalizedAddress = address.trim();
  
  // 1. 광역시 패턴 (구 단위)
  const metropolitanPattern = /(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시)\s*([가-힣]+구)/;
  const metropolitanMatch = normalizedAddress.match(metropolitanPattern);
  
  if (metropolitanMatch) {
    const city = metropolitanMatch[1].replace(/(특별시|광역시|특별자치시)/, '');
    const district = metropolitanMatch[2];
    return `${city} ${district}`;
  }
  
  // 2. 도 지역 패턴 (시/군 단위)
  const provincePattern = /(경기도|강원특별자치도|충청북도|충청남도|전라북도|전라남도|경상북도|경상남도|제주특별자치도|강원도)\s*([가-힣]+[시군])/;
  const provinceMatch = normalizedAddress.match(provincePattern);
  
  if (provinceMatch) {
    return provinceMatch[2]; // 시/군만 반환
  }
  
  // 3. 특수 케이스: 세종시
  if (normalizedAddress.includes('세종특별자치시')) {
    return '세종시';
  }
  
  // 4. 기타 패턴 시도 (시/군 직접 추출)
  const directPattern = /([가-힣]+[시군])/;
  const directMatch = normalizedAddress.match(directPattern);
  
  if (directMatch) {
    return directMatch[1];
  }
  
  // 5. 실패 시 첫 번째 지역명 반환
  const firstRegion = normalizedAddress.split(' ')[0];
  return firstRegion || '지역 정보 없음';
}

/**
 * 상세 지역 정보 추출 (분석용)
 */
export function parseAddressDetails(address: string): RegionInfo {
  const region = extractBattleRegion(address);
  
  let level: 'district' | 'city' | 'county' = 'city';
  
  if (region.includes('구')) {
    level = 'district';
  } else if (region.includes('군')) {
    level = 'county';
  }
  
  return {
    region,
    level,
    fullAddress: address
  };
}

/**
 * 주소 예시들로 테스트
 */
export function testAddressParsing() {
  const testCases = [
    "인천광역시 서구 청라동 123-45",
    "서울특별시 강남구 역삼동 678-90", 
    "부산광역시 해운대구 우동 111-22",
    "경기도 안산시 단원구 고잔동 333-44",
    "강원도 춘천시 효자동 555-66",
    "충청남도 천안시 서북구 쌍용동 777-88",
    "전라북도 전주시 완산구 중앙동 999-00",
    "제주특별자치도 제주시 일도동 123-45",
    "세종특별자치시 조치원읍 123-45"
  ];
  
  console.log("주소 파싱 테스트:");
  testCases.forEach(address => {
    const result = extractBattleRegion(address);
    console.log(`"${address}" → "${result}"`);
  });
}

// 개발 환경에서만 테스트 실행
if (process.env.NODE_ENV === 'development') {
  // testAddressParsing();
}
