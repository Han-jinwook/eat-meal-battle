# HELP (RESET)

## 현재 최우선 이슈

### 증상
- 경로: `프로필 -> 학교설정`
- 기존처럼 `/login` 강제 이동은 줄였지만, 현재는 **모달이 뜨지 않고 먹통처럼 보임**.

### 사용자 확인 상태
- 사용자 피드백: "로그인으로 튀진 않지만 학교설정 모달이 뜨지 않음"
- 브라우저 주소 표시줄 캡처에서는 이전에 `/login`으로 튀는 현상도 있었음.

---

## 이번 세션에서 한 작업 요약

1) 프로필 학교설정 플로우 연결
- 파일: `src/components/ProfileClient.tsx`
- 변경:
  - `SchoolRegistrationFlowModal` 연결
  - `allowFamilyRegistration={false}`로 설정 (본인 등록 전용)
  - 학교 저장 시 `school_infos` upsert 흐름 추가
  - 관심학교 API(`/api/interest-schools`) 호출 추가

2) 클릭 시 로그인 튐 완화
- 파일: `src/components/ProfileClient.tsx`
- 변경:
  - `학교설정` 버튼 클릭 핸들러를 `async`로 변경
  - `supabase.auth.getUser()` 재확인 후 유저 있으면 모달 열도록 수정
  - 인증 없음일 때 `/login` 강제 이동 제거(안내 문구만)

3) 라우팅/인증 관련 이전 변경(연속 작업 맥락)
- `src/lib/supabase-server.ts`: Next.js 16 `cookies()` 비동기 대응
- `src/middleware.ts`: 서버 Supabase 생성 `await` 반영, `/profile` 비보호 처리
- `src/app/profile/page.tsx`: 강제 로그인 redirect 제거, 비로그인도 렌더 허용

---

## 현재 의심 지점 (새 세션에서 바로 확인)

1) `ProfileClient`의 인증 상태 불일치
- 서버에서 `initialUser`가 `null`로 들어오고, 클라이언트 세션과 타이밍이 어긋나는 경우
- 클릭 핸들러에서 `getUser()` 재확인했지만 여전히 모달 오픈 상태 변경이 반영 안 될 가능성

2) `BirthConsentModal` 진입 조건 분기
- 조건: `!userProfile?.birth_date || userProfile?.is_student === null`
- 이 분기에서 `setShowBirthConsentModal(true)`가 호출되지만 실제 렌더가 안 되는지 확인 필요

3) `SchoolRegistrationFlowModal` 렌더 조건/스타일 충돌
- `isOpen` 상태가 true로 바뀌는지 콘솔로 확인
- 포털/오버레이 z-index, 부모 요소 스타일 충돌 여부 점검

4) Supabase 브라우저 클라이언트 커스텀 fetch 영향
- 파일: `src/lib/supabase.ts`
- 전역 fetch 커스터마이징이 auth/user 조회에 간접 영향 없는지 점검

---

## 새 세션 디버깅 체크리스트 (권장 순서)

1. `학교설정` 클릭 직후 로그 확인
- `src/components/ProfileClient.tsx` 버튼 핸들러에 임시 로그 추가:
  - `authData.user`
  - `userProfile.birth_date`, `userProfile.is_student`
  - `setShowBirthConsentModal` / `setIsSchoolRegistrationFlowOpen` 분기 도달 여부

2. 실제 state 변경 확인
- React DevTools로 다음 state가 true로 바뀌는지 확인:
  - `showBirthConsentModal`
  - `isSchoolRegistrationFlowOpen`

3. 모달 컴포넌트 단독 강제 오픈 테스트
- 임시로 `isOpen={true}` 하드코딩 후 렌더 확인
- 보이면 상태/분기 문제, 안 보이면 스타일/레이아웃 충돌 문제

4. `/profile` 최초 진입 사용자 정보 소스 점검
- 서버 `initialUser`와 클라이언트 `supabase.auth.getUser()` 값 비교
- 필요 시 마운트 시점에 클라이언트 auth hydrate 로직 추가

---

## 참고: 라우트 정리 계획 메모
- `/whateat`는 모니터링 기간 후 제거 예정
- 현재는 fallback 용도로 유지

---

## 이번 세션 마지막 상태
- 사용자 요청에 따라 여기까지 기록 후 세션 종료.
- 다음 세션은 **프로필 학교설정 모달 미표시(먹통) 원인 고정**부터 시작하면 됨.
