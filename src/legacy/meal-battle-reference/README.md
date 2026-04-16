# Legacy Meal-Battle Reference Map

이 문서는 `급식배틀` 레거시 코드를 백업한 뒤, **기존 연결관계(라우트 ↔ 호출 지점)** 를 추적하기 위한 인덱스입니다.

## 1) 백업 이동 매핑

| 기존 라우트 폴더 | 백업 위치 |
|---|---|
| `src/app/battle` | `src/legacy/meal-battle-reference/app/battle` |
| `src/app/quiz` | `src/legacy/meal-battle-reference/app/quiz` |
| `src/app/school-search` | `src/legacy/meal-battle-reference/app/school-search` |

## 2) 메인 라우팅 차단(완료)

아래 파일에서 메인 사용자 진입 링크를 끊어, 이동된 레거시 라우트로 직접 진입하지 않도록 조치했습니다.

| 파일 | 변경 내용 |
|---|---|
| `src/components/MainHeader.tsx` | 상단 네비에서 `/battle`, `/quiz` 제거 (급식만 유지) |
| `src/app/whateat/page.tsx` | Meal 서브탭에서 `battle`, `quiz` 제거 (meal만 유지) |
| `src/app/MealClient.tsx` | 학생 미등록 시 `/school-search` 라우팅 대신 학교검색 모달 오픈으로 전환 |

## 3) 기존 연결관계 인덱스(레퍼런스)

아래는 과거 레거시 라우트로 연결되던 대표 지점입니다.

### `/battle`
- `src/components/MainHeader.tsx` (기존 상단 메뉴)
- `src/app/whateat/page.tsx` (기존 meal 서브탭)
- `src/app/ranking/[region]/page.tsx` (리다이렉트 경유)
- `src/app/not-found.tsx` (404 페이지 CTA)
- `src/app/sitemap-page/page.tsx` (사이트맵 링크)

### `/quiz`
- `src/components/MainHeader.tsx` (기존 상단 메뉴)
- `src/app/whateat/page.tsx` (기존 meal 서브탭)
- `src/components/QuizDropdown.tsx` (내 학교로 돌아가기)
- `src/app/not-found.tsx` (404 페이지 CTA)
- `src/app/sitemap-page/page.tsx` (사이트맵 링크)

### `/school-search`
- `src/components/ProfileClient.tsx` (프로필에서 학교 설정 진입)
- `src/app/MealClient.tsx` (학생 미등록 분기, 현재는 모달 처리로 전환)
- `src/app/auth/callback/route.ts` (OAuth 후 분기 리다이렉트)

## 4) 현재 상태 메모

- 레거시 라우트 폴더 자체는 백업 경로로 이동되어 보존되어 있습니다.
- 메인 헤더/WhatEat 진입 링크는 차단되었습니다.
- 일부 비메인 보조 링크(`not-found`, `sitemap`, 일부 callback/profile 분기)는 다음 정리 단계에서 추가 차단 대상입니다.

---

다음 단계에서 이 문서를 기준으로 남은 참조를 순차 제거/치환하면,
기능은 안전하게 분리하면서도 추적성은 유지할 수 있습니다.
