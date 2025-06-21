/**
 * 날짜 관련 유틸리티 함수 모음
 */

/**
 * 날짜 형식 변환 (YYYYMMDD -> YYYY-MM-DD) + 요일 표시
 * @param dateStr YYYYMMDD 형식의 날짜 문자열
 * @returns YYYY-MM-DD (요일) 형식의 문자열
 */
export const formatDisplayDate = (dateStr: string) => {
  if (!dateStr) return dateStr;
  
  // YYYYMMDD 형식을 YYYY-MM-DD로 변환
  let formattedDate = dateStr;
  if (dateStr.length === 8 && !dateStr.includes('-')) {
    formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  
  // 요일 계산
  const date = new Date(formattedDate);
  if (isNaN(date.getTime())) return formattedDate; // 유효하지 않은 날짜인 경우
  
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[date.getDay()];
  
  return `${formattedDate} (${weekday})`;
};

/**
 * API 호출용 날짜 형식 변환 (YYYY-MM-DD -> YYYYMMDD)
 * @param dateStr YYYY-MM-DD 형식의 날짜 문자열
 * @returns YYYYMMDD 형식의 문자열
 */
export const formatApiDate = (dateStr: string) => {
  if (!dateStr) return '';
  // 이미 YYYYMMDD 형식인 경우 그대로 반환
  if (dateStr.length === 8 && !dateStr.includes('-')) {
    console.log(`이미 API 형식인 날짜: ${dateStr}`);
    return dateStr;
  }
  return dateStr.replace(/-/g, '');
};

/**
 * 현재 날짜를 YYYY-MM-DD 형식으로 가져오기
 * @returns YYYY-MM-DD 형식의 현재 날짜
 */
export const getCurrentDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  // HTML date input에 필요한 YYYY-MM-DD 형식으로 반환
  return `${year}-${month}-${day}`;
};

/**
 * 주말 체크 함수
 * @param dateStr YYYY-MM-DD 형식의 날짜 문자열
 * @returns 주말(토,일)이면 true, 평일이면 false
 */
export const isWeekend = (dateStr: string) => {
  const date = new Date(dateStr);
  const day = date.getDay();
  return day === 0 || day === 6; // 0: 일요일, 6: 토요일
};
