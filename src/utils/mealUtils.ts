/**
 * 급식 타입 코드를 읽기 쉬운 형태로 변환합니다.
 */
export function getMealTypeName(mealType: string): string {
  switch(mealType) {
    case '1':
      return '조식';
    case '2':
      return '중식';
    case '3':
      return '석식';
    case '4':
      return '간식';
    default:
      return mealType; // 알 수 없는 경우 원래 코드 반환
  }
}
