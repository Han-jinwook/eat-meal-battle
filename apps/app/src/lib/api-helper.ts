/**
 * API 요청 유틸리티
 * 
 * 직접적인 API 호출을 안전하게 처리하고 오류를 관리하기 위한 헬퍼 함수
 */

// 기본 요청 함수 - API 키 검증과 오류 처리 추가됨
export async function fetchWithAuth(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  try {
    // API 키가 필요한 Supabase REST API 호출인지 확인
    if (url.includes('/rest/v1/') && !url.includes('apikey=')) {
      // API 키가 필요한 요청인데 authorization 헤더가 없는 경우 401 반환
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
    const response = await fetch(url, options);
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
