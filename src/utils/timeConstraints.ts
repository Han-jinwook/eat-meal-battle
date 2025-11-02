/**
 * 급식 관련 기능들의 통일된 시간 제약 함수
 * - 이미지 업로드/AI 생성
 * - 별점 평가  
 * - 댓글 작성
 * 모든 기능이 동일한 시간 제약을 적용받습니다.
 */

export const isWithinAllowedTime = (mealDate: string): boolean => {
  try {
    const now = new Date();
    const hour = now.getHours();
    const today = new Date().toISOString().split('T')[0];
    const targetDate = new Date(mealDate);
    const todayDate = new Date(today);
    
    // 1. 미래 날짜: 비활성화
    if (targetDate > todayDate) {
      return false;
    }
    
    // 2. 당일: 12시 이후만 활성화
    if (mealDate === today) {
      return hour >= 12;
    }
    
    // 3. 과거: 해당 급식일이 속한 주의 일요일 자정까지 허용
    const targetDay = targetDate.getDay(); // 0:일, 1:월, ..., 6:토
    const daysUntilSunday = 7 - (targetDay === 0 ? 7 : targetDay);

    const endOfWeek = new Date(targetDate);
    endOfWeek.setDate(targetDate.getDate() + daysUntilSunday);
    endOfWeek.setHours(23, 59, 59, 999); // 해당 주 일요일 자정

    // 오늘이 해당 급식 주간의 마지막 날(일요일)을 넘지 않았으면 허용
    return now <= endOfWeek;
    
  } catch (error) {
    console.error('시간 제약 확인 중 오류:', error);
    return false;
  }
};

/**
 * AI 이미지 생성 전용 시간 제약 (12:30 이후)
 */
export const isWithinAiAllowedTime = (mealDate: string): boolean => {
  try {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const today = new Date().toISOString().split('T')[0];
    
    // 기본 시간 제약 먼저 확인
    if (!isWithinAllowedTime(mealDate)) {
      return false;
    }
    
    // 당일의 경우 12:30 이후만 허용
    if (mealDate === today) {
      return hour > 12 || (hour === 12 && minute >= 30);
    }
    
    // 과거 날짜는 기본 제약만 적용
    return true;
    
  } catch (error) {
    console.error('AI 시간 제약 확인 중 오류:', error);
    return false;
  }
};

/**
 * 사용자에게 표시할 시간 제약 메시지
 */
export const getTimeConstraintMessage = (): string => {
  return '금주중 언제든 평가 가능 & 당일은 12시부터';
};
