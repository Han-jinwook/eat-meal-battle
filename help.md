# Merlin Family OS & WhatEat Referral System Stabilization Guide

## 📅 리셋(세션 전환) 일시
* **일시**: 2026년 6월 10일 14:50 (KST)
* **상황**: 이전 세션 완료 후, 새 세션에서 이어서 진행하기 위해 현재 상태와 남은 이슈를 상세히 기록합니다.

---

## 📌 현재 상태 및 이슈 요약

### 1. 동적 해시(#) URL 공유 (조치 완료)
* **이슈**: 어떤 메뉴/탭(예: 급식, 혼밥 등)을 눌러서 이동하더라도, 복사되는 링크가 항상 루트 도메인(`https://whateat.sundreamer.app/`)으로 고정되던 결함.
* **조치**: 
  - `WhatEat` 앱의 [WhatEatApp.tsx](file:///d:/WhatEat/src/components/whateat/WhatEatApp.tsx) 및 [ProfileClient.tsx](file:///d:/WhatEat/src/components/ProfileClient.tsx) 등에서 `HubShareSquare`를 호출할 때 하드코딩되었던 `customUrl` 속성을 완전히 제거하여 배포를 완료했습니다.
  - 이제 사용자가 위치한 탭의 해시(#) 주소(예: `#solo`, `#meal` 등)가 동적으로 결합되어 링크 복사 시 정상적으로 나타납니다.

### 2. 로그인 상태에서 초대 코드(?ref=) 누락 및 증발 현상 (원인 파악 및 수정 대기)
* **이슈**: 로그인된 상태에서 링크를 공유하려고 할 때, URL에 추천인 코드(`?ref=초대코드`)가 붙지 않고 계속 유실되는 현상.
* **근본 원인**:
  - `HubShareSquare.tsx` 컴포넌트의 마운트 시점에서 `localStorage`에 유효한 초대코드(`userReferralCode`)가 존재하더라도, 아래 `useEffect` 비동기 로직에 의해 강제로 공백(`''`)으로 덮어써집니다.
    ```typescript
    useEffect(() => {
      const fetchInfo = async () => {
        const info = await getMyReferralInfo();
        if (info?.code) {
          setInviteCode(info.code);
          if (typeof window !== 'undefined') {
            localStorage.setItem('userReferralCode', info.code);
          }
        } else {
          setInviteCode(''); // <- API 응답 지연/부재 시 기존 로컬스토리지 값마저 날려버리는 원인!
        }
      };
      fetchInfo();
    }, [getMyReferralInfo, isLoggedIn]);
    ```
  - 로그인 상태(`isLoggedIn`)가 변하거나 컴포넌트가 다시 그릴 때, API(`getMyReferralInfo`)로부터 데이터를 아직 받아오지 못했거나 응답이 일시적으로 지연되는 시점에 `else { setInviteCode(''); }`를 타게 되어 유효한 추천인 코드가 초기화되고 캐시가 유실됩니다.

---

## 🛠️ 새 세션 작업 계획 (Next Steps)

### Step 1. `HubShareSquare.tsx` 수정 반영
* **수정 대상 파일**:
  1. `WhatEat` 프로젝트: [HubShareSquare.tsx](file:///d:/WhatEat/src/services/merlin-hub-sdk/Referral/HubShareSquare.tsx)
  2. `MerlinFamilyOS` 프로젝트: [HubShareSquare.tsx](file:///d:/MerlinFamilyOS/허브_라이브러리/Referral/HubShareSquare.tsx)
* **코드 수정 상세**:
  - `else { setInviteCode(''); }` 분기를 제거하고, API가 정상적으로 신규 추천인 코드를 내려주었을 때만 상태와 로컬스토리지를 갱신하도록 처리합니다.
  - 로그인 상태가 확실할 때만 API를 호출하도록 안전 장치(예: `if (isLoggedIn) fetchInfo();`)를 확보합니다.
  - **수정 예시**:
    ```typescript
    useEffect(() => {
      const fetchInfo = async () => {
        const info = await getMyReferralInfo();
        if (info?.code) {
          setInviteCode(info.code);
          if (typeof window !== 'undefined') {
            localStorage.setItem('userReferralCode', info.code);
          }
        }
        // else { setInviteCode(''); } 를 제거하여 기존 localStorage 값을 유지
      };
      if (isLoggedIn) {
        fetchInfo();
      }
    }, [getMyReferralInfo, isLoggedIn]);
    ```

### Step 2. 버전 갱신 및 라이브러리 대장 업데이트
* **버전 정보**: 허브 라이브러리 버전을 `v3.2.4`, `HubShareSquare` 모듈 버전을 `v1.0.5`로 상향 조정합니다.
* **라이브러리 대장**: `MerlinFamilyOS` 프로젝트의 `라이브러리_대장.md` 파일에 변경 내용을 기록합니다.

### Step 3. 빌드 및 배포 테스트
* `WhatEat` 프로젝트 경로에서 빌드 테스트를 수행합니다: `npm run build`
* 빌드가 성공하면 두 레포지토리의 변경 사항을 Git에 스테이징/커밋하고 `main` 브랜치에 각각 push합니다.
* 사용자가 카카오톡 캐시 초기화를 마쳤으므로, 최종 웹 서비스 배포가 끝난 뒤 브라우저를 강력 새로고침(`Ctrl + F5`)하여 로그인 후 정상적으로 `https://whateat.sundreamer.app/?ref=추천코드#meal` 형태로 복사되는지 최종 확인합니다.
