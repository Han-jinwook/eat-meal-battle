/**
 * 한국 공휴일 데이터 (하드코딩)
 * 매년 12월에 다음 연도 데이터 추가 필요
 * 정부 발표 기준으로 업데이트
 */

export interface Holiday {
  date: string; // YYYY-MM-DD 형식
  name: string; // 공휴일명
}

export const HOLIDAYS: Record<number, Record<string, string>> = {
  2025: {
    '2025-01-01': '신정',
    '2025-01-28': '설날연휴',
    '2025-01-29': '설날',
    '2025-01-30': '설날연휴',
    '2025-03-01': '삼일절',
    '2025-05-05': '어린이날',
    '2025-05-06': '대체공휴일',
    '2025-06-06': '현충일',
    '2025-08-15': '광복절',
    '2025-10-03': '개천절',
    '2025-10-06': '추석연휴',
    '2025-10-07': '추석',
    '2025-10-08': '추석연휴',
    '2025-10-09': '한글날',
    '2025-12-25': '크리스마스'
  },
  2026: {
    // 2025년 12월에 정부 발표 후 추가 예정
    // 미리 알려진 고정 공휴일만 추가
    '2026-01-01': '신정',
    '2026-03-01': '삼일절',
    '2026-05-05': '어린이날',
    '2026-06-06': '현충일',
    '2026-08-15': '광복절',
    '2026-10-03': '개천절',
    '2026-10-09': '한글날',
    '2026-12-25': '크리스마스'
  }
};

/**
 * 특정 연도의 공휴일 데이터를 가져오는 함수
 * @param year 연도 (예: 2025)
 * @returns 해당 연도의 공휴일 객체 (날짜: 공휴일명)
 */
export function getHolidaysForYear(year: number): Record<string, string> {
  return HOLIDAYS[year] || {};
}

/**
 * 특정 날짜가 공휴일인지 확인하는 함수
 * @param date YYYY-MM-DD 형식의 날짜 문자열
 * @returns 공휴일이면 공휴일명, 아니면 null
 */
export function getHolidayName(date: string): string | null {
  const year = parseInt(date.substring(0, 4));
  const yearHolidays = getHolidaysForYear(year);
  return yearHolidays[date] || null;
}

/**
 * 특정 월의 공휴일 목록을 가져오는 함수
 * @param year 연도
 * @param month 월 (1-12)
 * @returns 해당 월의 공휴일 배열
 */
export function getHolidaysForMonth(year: number, month: number): Holiday[] {
  const yearHolidays = getHolidaysForYear(year);
  const monthStr = month.toString().padStart(2, '0');
  const prefix = `${year}-${monthStr}`;
  
  return Object.entries(yearHolidays)
    .filter(([date]) => date.startsWith(prefix))
    .map(([date, name]) => ({ date, name }));
}
