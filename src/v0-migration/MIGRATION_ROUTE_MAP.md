# v0 → WhatEat 라우트 연결 매핑 (안전 모드)

원칙:
- `src/v0-migration`은 원본/분류본을 보관하는 스테이징 영역으로 유지
- 실제 서비스 라우트 연결은 `src/app`에서 최소 변경으로 진행
- 인증 로직은 기존 WhatEat(`login`, `auth`, `hooks`)을 우선 사용

## 1) 목표 탭 구조 (최종)

- 메인 탭 4개
  - 탭1: 메뉴1 (solo)
  - 탭2: 메뉴2 (family)
  - 탭3: 메뉴3 (talk/feed)
  - 탭4: 급식배틀 (기존 meal/battle/quiz 묶음)

## 2) v0 소스 컴포넌트 매핑

### 탭1 (solo)
- 소스: `src/v0-migration/main-menu/menu-1/*`
- 핵심 컴포넌트:
  - `meal-log-tab.tsx`
  - `reservation-tab.tsx`
  - `meal-calendar-tab.tsx`
  - `add-log-modal.tsx`
  - `add-reservation-modal.tsx`

### 탭2 (family)
- 소스: `src/v0-migration/main-menu/menu-2/family-page.tsx`

### 탭3 (talk/feed)
- 소스:
  - `src/v0-migration/main-menu/menu-3/talk-page.tsx`
  - `src/v0-migration/main-menu/menu-3/feed-tab.tsx`

### 탭4 (급식배틀)
- 기존 WhatEat 유지 경로:
  - 급식: `src/app/page.tsx` + `src/app/MealClient.tsx`
  - 배틀: `src/app/battle/*`
  - 퀴즈: `src/app/quiz/*`

## 3) app 라우트 연결 권장안

### 3-1. 1차 (비파괴 연결)
- `src/app/whateat/page.tsx` 신설
  - v0 스타일 탭 컨테이너 연결 (탭1/2/3)
- 기존 `src/app/page.tsx`, `src/app/battle`, `src/app/quiz`는 유지
- 탭4 버튼은 기존 `/`, `/battle`, `/quiz`로 링크

### 3-2. 2차 (통합)
- `src/app/(main)/layout.tsx` 도입
- 4메뉴 고정 탭바 적용
- 급식배틀을 `src/app/(main)/school-battle/*`로 재배치
  - `meal`, `battle`, `quiz` 서브탭 구성

## 4) 즉시 실행 체크리스트

1. `whateat` 임시 라우트에서 v0 탭1/2/3 렌더링 확인
2. 기존 인증 세션 충돌 없는지 확인 (로그인/비로그인)
3. 탭4에서 기존 급식/배틀/퀴즈 진입 확인
4. 이후 통합 라우트 전환

## 5) 보류 항목

- 학생인증 세부 가드 분리(`AppAuth` vs `StudentProof`)는 통합 라우트 단계에서 적용
- 디자인 정리(폰트/색상/컴포넌트 통일)는 라우트 고정 이후 진행
