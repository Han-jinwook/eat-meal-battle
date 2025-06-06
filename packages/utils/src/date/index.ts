import { format } from 'date-fns';

/**
 * 오늘 날짜를 YYYY-MM-DD 형식으로 반환합니다.
 */
export function getCurrentDate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * 날짜를 YYYY-MM-DD 형식으로 포맷팅합니다.
 */
export function formatDisplayDate(date: string): string {
  // 이미 yyyy-MM-dd 형식이면 그대로 반환
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  
  // 다른 형식이면 변환 시도
  try {
    return format(new Date(date), 'yyyy-MM-dd');
  } catch (e) {
    console.error('날짜 포맷팅 오류:', e);
    return date;
  }
}

/**
 * 날짜를 API 호출용 YYYYMMDD 형식으로 포맷팅합니다.
 */
export function formatApiDate(date: string): string {
  if (/^\d{8}$/.test(date)) {
    return date; // 이미 YYYYMMDD 형식이면 그대로 반환
  }
  
  // YYYY-MM-DD 형식이면 변환
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date.replace(/-/g, '');
  }
  
  // 그 외에는 Date 객체로 변환 후 포맷팅
  try {
    return format(new Date(date), 'yyyyMMdd');
  } catch (e) {
    console.error('API 날짜 포맷팅 오류:', e);
    return date.replace(/-/g, '');
  }
}
