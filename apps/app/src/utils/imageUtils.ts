/**
 * 이미지 URL 관련 유틸리티 함수
 */

// 이미지 URL이 유효한지 확인하는 함수 (개발환경에서는 항상 true 반환)
export const isValidImageUrl = (url: string): boolean => {
  if (process.env.NODE_ENV === 'development') {
    return true; // 개발환경에서는 모든 URL을 유효하다고 간주
  }
  
  // URL이 유효한지 기본 검사
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// 이미지 URL을 안전하게 처리하는 함수
export const getSafeImageUrl = (url: string): string => {
  if (!url) {
    return '/images/placeholder.png'; // 기본 이미지 경로
  }
  
  // Supabase URL 또는 외부 URL이면 프록시 사용
  if ((url.includes('supabase.co') && url.includes('/storage/')) || url.startsWith('http')) {
    // 개발 환경에서는 프록시 사용 안 함 (CORS 이슈 방지)
    if (process.env.NODE_ENV === 'development') {
      // 개발 환경에서는 캐시 버스팅만 추가
      return `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
    }
    
    // 프로덕션 환경에서는 프록시 API 사용
    const encodedUrl = encodeURIComponent(url);
    return `/api/image-proxy?url=${encodedUrl}`;
  }
  
  return url;
};

// 이미지 로드 실패 시 폴백 처리 함수
export const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>): void => {
  const imgElement = e.currentTarget;
  imgElement.style.display = 'none';
  
  // 부모 요소에 배경색과 텍스트 추가
  if (imgElement.parentElement) {
    imgElement.parentElement.style.backgroundColor = '#f3f4f6';
    
    // 대체 텍스트 추가
    const placeholderText = document.createElement('div');
    placeholderText.innerText = '이미지를 불러올 수 없습니다';
    placeholderText.style.display = 'flex';
    placeholderText.style.alignItems = 'center';
    placeholderText.style.justifyContent = 'center';
    placeholderText.style.height = '100%';
    placeholderText.style.width = '100%';
    placeholderText.style.color = '#6b7280';
    placeholderText.style.fontSize = '14px';
    
    imgElement.parentElement.appendChild(placeholderText);
  }
  
  // 콘솔 에러 로깅 차단 (이벤트 중지)
  e.preventDefault();
  e.stopPropagation();
};
