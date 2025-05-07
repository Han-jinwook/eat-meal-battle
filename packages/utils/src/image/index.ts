/**
 * 이미지 URL 관련 유틸리티 함수
 */

/**
 * 이미지 URL이 유효한지 확인하는 함수
 * @param url 검사할 이미지 URL
 * @returns URL 유효성 여부
 */
export const isValidImageUrl = (url: string): boolean => {
  if (!url) return false;
  
  // 개발 환경에서와 로컬 경로는 항상 유효하다고 간주
  if (process.env.NODE_ENV === 'development' || url.startsWith('/')) {
    return true;
  }
  
  // URL 형식 검사
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * 이미지 URL을 예상 오류를 방지하는 안전한 버전으로 변환
 * @param url 처리할 이미지 URL
 * @returns 안전하게 처리된 URL
 */
export const getSafeImageUrl = (url: string | null | undefined): string => {
  // URL이 없거나 비어있으면 기본 이미지 반환
  if (!url || url.trim() === '') {
    return '/images/placeholder.jpg';
  }
  
  // 이미 프록시를 통해 처리된 URL은 그대로 반환
  if (url.startsWith('/api/image-proxy')) {
    return url;
  }
  
  // 로컬 이미지 경로는 그대로 반환
  if (url.startsWith('/') && !url.startsWith('//')) {
    return url;
  }

  // Supabase Storage URL 또는 외부 URL 처리
  try {
    // 1. 모든 상대경로 URL을 절대경로로 변환 (프로토콜 있는지 확인)
    if (url.startsWith('//')) {
      url = `https:${url}`;
    } else if (!url.startsWith('http')) {
      // 절대 URL이 아니고 프로토콜도 없는 경우 기본 이미지
      return '/images/placeholder.jpg';
    }
    
    // 2. 이제 URL을 처리하여 리턴
    
    // 2.1 Supabase 저장소의 이미지 URL인 경우 예외 처리
    if (url.includes('supabase.co') && url.includes('/storage/')) {
      // 개발 환경에서는 캐시 버스팅만 추가
      if (process.env.NODE_ENV === 'development') {
        return `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
      }
      
      // 프로덕션 환경에서는 프록시 API 사용
      const encodedUrl = encodeURIComponent(url);
      return `/api/image-proxy?url=${encodedUrl}`;
    }
    
    // 2.2 그 외 외부 URL은 프록시를 통해 안전하게 처리
    if (url.startsWith('http')) {
      const encodedUrl = encodeURIComponent(url);
      return `/api/image-proxy?url=${encodedUrl}`;
    }
    
    // 예상치 못한 경우
    return '/images/placeholder.jpg';
    
  } catch (e) {
    console.warn('이미지 URL 처리 오류:', e);
    return '/images/placeholder.jpg';
  }
};

/**
 * 이미지 로드 실패 시 자동 폴백 처리
 * @param e 이미지 에러 이벤트
 */
export const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>): void => {
  try {
    const imgElement = e.currentTarget;
    
    // 1. 이미지 숨김
    imgElement.style.display = 'none';
    
    // 2. 부모 요소에 배경색과 텍스트 추가
    if (imgElement.parentElement) {
      imgElement.parentElement.style.backgroundColor = '#f3f4f6';
      
      // 대체 텍스트 추가 (이미 있는지 확인)
      if (!imgElement.parentElement.querySelector('.image-fallback')) {
        const placeholderText = document.createElement('div');
        placeholderText.innerText = '이미지를 불러올 수 없습니다';
        placeholderText.className = 'image-fallback flex items-center justify-center h-full w-full text-gray-500 text-sm';
        
        imgElement.parentElement.appendChild(placeholderText);
      }
    }
    
    // 3. 콘솔 에러 방지
    e.preventDefault();
  } catch (err) {
    // 에러 처리 중 오류 방지 (무한 순환 방지)
    console.warn('이미지 에러 처리 중 오류 발생', err);
  }
};
