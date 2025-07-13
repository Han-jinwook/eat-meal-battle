# 장원 조건 계산 로직 수정 작업 (2025-07-14)

## 🎯 작업 목표
- 주간 급식일 계산에서 주말/공휴일 제외 및 중복 제거 문제 해결
- 정확한 중식만 필터링 및 주차별 계산 로직 구현
- 기존 잘못된 데이터 정상화

## 🔍 발견된 문제들

### 1. 중복 처리 문제
- **현상**: 같은 날짜가 두 번 처리되어 과다 집계
- **예시**: 20250707, 20250708이 두 번씩 카운트
- **원인**: NEIS API 데이터에서 중복 날짜 제거 로직 부재

### 2. 주말 제외 미작동
- **현상**: 원본 13일, 필터링 후에도 13일로 주말이 전혀 제외되지 않음
- **원인**: `isWeekdayAndNotHoliday` 함수 로직 오류

### 3. 과다 집계
- **현상**: week1이 7일, week2가 6일로 실제보다 많이 계산
- **원인**: 중복 제거 + 주말 제외 로직 미작동

### 4. 파일 호출 오류
- **현상**: 404 오류로 함수 실행 안됨
- **원인**: `initialize-school-champion-criteria.js` 파일 삭제
- **해결**: 올바른 파일 복구

### 5. DB 저장 오류
- **현상**: `Could not find the 'week_6_days' column`
- **원인**: 이미 삭제된 `week_6_days` 컬럼을 코드에서 참조
- **해결**: `week_6_days` 참조 제거

## ✅ 해결 방안

### 1. NEIS API 데이터 필터링 개선
```javascript
// 중식만 필터링 (MMEAL_SC_CODE === '2')
const lunchMeals = meals.filter(meal => meal.MMEAL_SC_CODE === '2')

// 날짜만 추출하고 중복 제거
const uniqueDates = [...new Set(lunchMeals.map(meal => meal.MLSV_YMD))]

// 주말과 공휴일 제외
const filteredDates = uniqueDates.filter(dateStr => isWeekdayAndNotHoliday(dateStr))
```

### 2. 주말/공휴일 제외 함수 수정
```javascript
function isWeekdayAndNotHoliday(dateStr) {
  const year = parseInt(dateStr.substring(0, 4))
  const month = parseInt(dateStr.substring(4, 6)) - 1
  const day = parseInt(dateStr.substring(6, 8))
  const date = new Date(year, month, day)
  const dayOfWeek = date.getDay()
  
  // 주말 제외 (0=일요일, 6=토요일)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false
  }
  
  // 2025년 한국 공휴일 체크
  const holidays2025 = ['20250101', '20250127', ...]
  return !holidays2025.includes(dateStr)
}
```

### 3. 주차별 계산 로직 개선
```javascript
function calculateWeeklyMealDays(mealDays, year, month) {
  // YYYYMMDD 형식을 올바르게 파싱
  const dateYear = parseInt(dateStr.substring(0, 4))
  const dateMonth = parseInt(dateStr.substring(4, 6)) - 1
  const dateDay = parseInt(dateStr.substring(6, 8))
  const date = new Date(dateYear, dateMonth, dateDay)
  
  // 최대 5주차까지만 계산
  if (weekNumber <= 5) {
    weeklyCount[weekNumber] = (weeklyCount[weekNumber] || 0) + 1
  }
}
```

### 4. DB 저장 함수 수정
```javascript
// week_6_days 컬럼 참조 제거
const { error } = await supabase.from('champion_criteria').upsert({
  school_code: schoolCode,
  year,
  month,
  week_1_days: weeklyMealDays[1] || 0,
  week_2_days: weeklyMealDays[2] || 0,
  week_3_days: weeklyMealDays[3] || 0,
  week_4_days: weeklyMealDays[4] || 0,
  week_5_days: weeklyMealDays[5] || 0,
  // week_6_days: weeklyMealDays[6] || 0, // 제거됨
  month_total: monthlyTotal,
  created_at: new Date().toISOString()
})
```

## 📊 수정 결과 검증

### 테스트 케이스: 학교 7004207, 2025년 7월
- **원본 데이터**: 13개 급식 데이터
- **중식 필터링 후**: 9개
- **주말/공휴일 제외 후**: 9개 (정상)
- **주차별 분배**: 1주차 5일, 2주차 4일 (정상)

### 로그 예시
```
Jul 13, 11:44:33 PM: 20250707 = 2025/7/7 (월)
Jul 13, 11:44:33 PM: 20250708 = 2025/7/8 (화)
Jul 13, 11:44:33 PM: 20250709 = 2025/7/9 (수)
Jul 13, 11:44:33 PM: 20250710 = 2025/7/10 (목)
Jul 13, 11:44:33 PM: 20250711 = 2025/7/11 (금)
Jul 13, 11:44:33 PM: 20250714 = 2025/7/14 (월)
Jul 13, 11:44:33 PM: 20250715 = 2025/7/15 (화)
Jul 13, 11:44:33 PM: 20250716 = 2025/7/16 (수)
Jul 13, 11:44:33 PM: 20250717 = 2025/7/17 (목)
```

## 🗂️ 수정된 파일들

### 1. `initialize-school-champion-criteria.js`
- **위치**: `/netlify/functions/initialize-school-champion-criteria.js`
- **수정 내용**: 
  - 중식 필터링 로직 추가
  - 주말/공휴일 제외 함수 구현
  - 중복 제거 로직 추가
  - 상세 로깅 추가
  - `week_6_days` 참조 제거

### 2. 삭제된 파일들
- `initialize-champion-criteria.js` (중복 파일)
- `bulk-update-champion-criteria.js` (불필요한 임시 파일)

## 🔧 데이터 정상화 방법

### 기존 잘못된 데이터 삭제 SQL
```sql
-- 2025년 7월 모든 학교의 champion_criteria 데이터 삭제
DELETE FROM champion_criteria 
WHERE year = 2025 AND month = 7;

-- 삭제 확인
SELECT COUNT(*) as deleted_records 
FROM champion_criteria 
WHERE year = 2025 AND month = 7;
```

## 🎯 핵심 교훈

### 1. 파일 호출 관계 확인 중요성
- 프론트엔드에서 실제 호출하는 파일명 확인 필수
- `school-search/page.tsx`에서 `initialize-school-champion-criteria` 호출
- 잘못된 파일 수정으로 시간 낭비 방지

### 2. DB 스키마 변경 추적
- 삭제된 컬럼(`week_6_days`) 참조로 인한 오류
- 마이그레이션 파일과 코드 동기화 중요

### 3. 상세 로깅의 중요성
- 각 단계별 데이터 변화 추적
- 날짜별 요일 표시로 필터링 검증
- 디버깅 시간 단축

### 4. 불필요한 파일 생성 지양
- SQL로 해결 가능한 문제에 함수 파일 생성 지양
- 코드베이스 정리 및 유지보수성 고려

## 🚀 향후 개선 사항

1. **공휴일 데이터 동적 관리**
   - 하드코딩된 2025년 공휴일을 API나 설정 파일로 관리
   
2. **NEIS API 호출 최적화**
   - 캐싱 메커니즘 도입
   - 호출 제한 관리

3. **에러 핸들링 강화**
   - 더 구체적인 에러 메시지
   - 재시도 로직 구현

## 📝 작업 완료 체크리스트

- [x] 중식만 필터링 로직 구현
- [x] 주말/공휴일 제외 함수 수정
- [x] 중복 날짜 제거 로직 추가
- [x] 주차별 계산 로직 개선
- [x] 상세 로깅 추가
- [x] `week_6_days` 컬럼 참조 제거
- [x] 올바른 함수 파일 복구
- [x] 불필요한 파일 정리
- [x] 데이터 정상화 SQL 작성
- [x] 테스트 및 검증 완료

---
**작업자**: Cascade AI  
**작업일**: 2025-07-14  
**소요시간**: 약 2시간  
**상태**: 완료 ✅
