# WhatEat Family Avatar Sync Issue & Handover Note

## 1. 현재 상황 및 요약
현재 "가족방"에서 **방장(스타크)**과 **초대된 가족 멤버(멀린)**가 서로를 조회할 때 프로필 아바타 이미지 동기화가 제대로 이루어지지 않고 있는 이슈가 있습니다.
- **멀린 화면**: `나` 탭에 본인의 고유 캐릭터 이미지(고깔 모자를 쓴 아기 캐릭터)가 정상적으로 잘 보임.
- **스타크 화면**: 멀린의 프로필 자리에 엉뚱한 여성 사진(Unsplash 프리셋)이나 "멀" 텍스트 이니셜이 보임.

## 2. 최근 작업 내역 (커밋 `ee0e70ef`)
1. **Unsplash 임시 인덱스 프리셋 제거**:
   - `family-page.tsx` 내 `loadRealFamily()` 함수에서 DB에 이미지 경로가 없을 때 순환 참조하며 적용되던 불필요한 `avatarPresets` 폴백을 완전히 배제하고, `merlinAvatar` 및 `starkAvatar` 상수 이미지로 매핑하도록 정리함.
2. **UI 렌더링 수정**:
   - 가족 구성원 헤더 리스트와 `ChefModal`에서 `HubAvatar` 혹은 `<img src={...}>`의 조건식을 통해 각 구성원의 고유 `avatar` 값을 직접 우선하여 그리도록 수정함.

## 3. 남아있는 이슈 및 원인 추정
코드를 고치고 푸시했음에도 화면에 **"변화가 없다"**(여전히 엉뚱한 사진이 보임)고 하시는 상태입니다. 이에 따른 기술적 원인 분석 및 추정 요인은 다음과 같습니다:

1. **상태(State) 업데이트 시점의 비동기 불일치**:
   - `loadRealFamily()` 내부의 `otherMembersData.map(...)` 루프가 돌기 전에 Supabase DB의 `users` 테이블에 멀린의 `profile_image` 정보가 즉각 동기화되지 않았을 가능성.
   - 혹은 `referrals` 관계를 찾은 뒤 `refereeIds`를 통해 사용자 정보를 가져올 때, Supabase 데이터 쿼리 실패 또는 네트워크 딜레이로 인해 프론트엔드의 데모 폴백 목록(`realOtherMembers.length === 0`일 때 강제로 푸시되는 값)이 적용되는 문제.
2. **`realOtherMembers` 매핑 시 닉네임 문자열 매칭 실패**:
   - `m.nickname?.includes("멀린")` 조건식이 동작하지 않고 엉뚱한 임시 데이터 혹은 다른 아바타가 로드되는 현상.
   - 데이터베이스 상 멀린의 실제 저장 닉네임이 `"가족회원"` 혹은 `"가족"` 등으로 매핑되어 `"멀린"` 필터링을 타지 못하고 다른 이미지 경로를 반환할 수 있음.
3. **클라이언트 브라우저 캐싱**:
   - React 빌드 본들 또는 로컬스토리지에 저장된 유저 캐시 정보(`localStorage.getItem('userProfileImage')` 등)가 최신화되지 않아 기존 이미지가 지속 노출되는 경우.

## 4. 새 세션 진행 가이드
다음 세션에서 즉시 작업을 이어갈 수 있도록 코드 상의 주요 로케이션 정보를 남깁니다:
- **핵심 파일**: [family-page.tsx](file:///d:/WhatEat/src/components/whateat/family-page.tsx)
- **로직 분석 및 수정 대상 위치**:
  - `loadRealFamily()` 함수 내부 (약 324라인 ~ 510라인): `otherMembersData`를 파싱하여 `avatar` 경로를 결정하는 영역.
  - `UserSync.tsx` (유저 로그인 정보 Supabase DB 동기화): `profile_image`가 Supabase `users` 테이블에 정상적으로 기록되는지 테스트 필수.
  - 가족 리스트 및 아바타 렌더링 JSX 영역 (약 2095라인 부근 및 2990라인 부근).

---
새 세션에서 위 가이드라인을 참조하여 **스타크와 멀린 간의 고유 프로필 아바타 매핑**을 심플하고 완벽하게 마무리해주시기 바랍니다.
