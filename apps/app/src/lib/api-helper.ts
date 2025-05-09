/**
 * API 요청 유틸리티
 * 
 * 직접적인 API 호출을 안전하게 처리하고 오류를 관리하기 위한 헬퍼 함수
 */

// 클라이언트 측에서만 실행되는 코드 (SSR 대응)
let originalFetch: typeof fetch;

// 브라우저 환경인지 확인
if (typeof window !== 'undefined') {
  // 원래의 fetch 함수 보관
  originalFetch = window.fetch;
  
  // 전역 fetch 함수 오버라이드
  window.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // URL 추출
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  
  // Supabase 직접 REST API 호출 감지
  if (url.includes('izkumvvlkrgiucczftp.supabase.co/rest/v1/')) {
    // API 키 헬더 확인
    const hasApiKey = init?.headers && (
      Object.entries(init.headers).some(([k, v]) => 
        k.toLowerCase() === 'apikey' || k.toLowerCase() === 'authorization'
      )
    );
    
    // API 키가 없는 경우 401 응답 반환
    if (!hasApiKey) {
      console.debug('권한 없는 Supabase REST API 요청 차단:', url);
      return Promise.resolve(new Response(JSON.stringify({
        message: "No API key found in request",
        hint: "No 'apikey' request header or url param was found."
      }), { status: 401 }));
    }
  }
  
  // 일반 요청은 원래 fetch로 처리
  return originalFetch(input, init);
  };
}

// 기본 요청 함수 - API 키 검증과 오류 처리 추가됨
export async function fetchWithAuth(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  // 서버 측에서 originalFetch가 정의되지 않은 경우 기본 fetch 사용
  const fetchFunc = typeof originalFetch !== 'undefined' ? originalFetch : fetch;
  try {
    // API 키가 필요한 Supabase REST API 호출인지 확인
    if ((url.includes('/rest/v1/') || url.includes('izkumvvlkrgiucczftp.supabase.co/rest/v1/')) && !url.includes('apikey=')) {
      // API 키가 필요한 요청인데 authorization 헬더가 없는 경우 401 반환
      if (!options.headers || 
          !Object.entries(options.headers).some(([k]) => 
             k.toLowerCase() === 'authorization' || k.toLowerCase() === 'apikey')) {
        console.warn('API 키 없는 요청 차단:', url);
        return new Response(
          JSON.stringify({
            error: 'No API key found in request',
            message: 'API 키가 필요한 요청입니다. 인증 정보를 확인하세요.'
          }),
          { status: 401 }
        );
      }
    }
    
    // 정상 요청 전송
    const response = await fetchFunc(url, options);
    
    // 404 오류 처리 - 삭제된 이미지 요청인 경우 조용히 처리
    if (response.status === 404 && url.includes('/meal_images') && url.includes('select=id')) {
      console.debug('삭제된 이미지 요청 처리:', url);
      return new Response(JSON.stringify({ data: null }), { status: 200 });
    }
    
    return response;
  } catch (error) {
    console.error('API 요청 오류:', error);
    return new Response(
      JSON.stringify({ 
        error: 'API request failed',
        message: '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      }),
      { status: 500 }
    );
  }
}

// API 엔드포인트 상수
export const API_ENDPOINTS = {
  MEALS: '/api/meals',
  MEAL_IMAGES: '/api/meal-images',
  SCHOOL: '/api/school',
  USER: '/api/user'
};
