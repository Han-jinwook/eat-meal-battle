# WhatEat Realtime Likes Synchronization Debugging Guide

## 📅 리셋(세션 전환) 일시
* **일시**: 2026년 7월 3일 12:25 (KST)
* **상황**: 좋아요 실시간 동기화 개발 중 런타임 에러(`ReferenceError: prev is not defined`)를 잡고, 새 세션으로 전환하여 실시간 동기화를 최종 검증하기 위한 기록입니다.

---

## 📌 현재 상태 및 이슈 요약

### 1. 실시간 소켓 연동 환경 완성 (조치 완료)
* **원인 분석**: 브라우저 클라이언트가 Supabase RLS 정책 하에서 `anon` 권한으로 동작하여 좋아요 테이블(`meal_likes`) 조회 권한이 막혀있던 현상 및 수파베이스 실시간 게시판(`supabase_realtime` publication)에 테이블이 누락된 현상을 해소했습니다.
* **마이그레이션 실행 완료 (멀린님 수동 실행)**:
  - `meal_likes` 테이블의 RLS `SELECT` 권한을 `anon` 및 `authenticated` 모두에게 허용.
  - `supabase_realtime` 게시판에 `meal_likes`, `comments`, `comment_replies` 테이블 추가 등록.
  - 실시간 삭제(`DELETE`) 시 `meal_id`를 누락 없이 온전히 수신하기 위해 `meal_likes`, `comments`, `comment_replies` 테이블의 `REPLICA IDENTITY`를 `FULL`로 변경 완료.
  - 이로 인해 양쪽 브라우저 콘솔(F12)에 좋아요 생성/삭제 시 수파베이스의 웹소켓 메시지가 누락 없이 완벽히 유입됨을 확인했습니다.

### 2. 디버깅 로그 추가 과정에서의 ReferenceError 결함 (원인 파악 및 조치 완료)
* **이슈**: 실시간 이벤트는 정상 수신되나 화면에 좋아요 숫자가 갱신되지 않고 콘솔에 `Uncaught ReferenceError: prev is not defined` 에러가 발생하는 현상.
* **원인**:
  - `likesChannel` 콜백 내에서 디버깅 로그를 출력할 때, `setPosts` 외부 스코프에 존재하지 않는 `prev` 상태 변수를 `prev.map(p => p.id)`로 불렀기 때문입니다.
* **조치**:
  - `prev.map` 대신 스코프 상에 올바르게 존재하는 `posts.map`을 참조하도록 수정 완료하여 깃에 커밋 및 강제 푸시를 완료했습니다.

---

## 🛠️ 새 세션 작업 계획 (Next Steps)

### Step 1. 배포 완료 확인 및 강력 새로고침
* 최신 커밋(`3cbd95cc` 또는 이메일 제약 조건 핫픽스가 포함된 `b19671d0`, 최종 ReferenceError 수정본 `1efb514d` 이후 버전)이 Netlify에 배포 완료되었는지 확인합니다.
* 테스트용 브라우저 두 개를 모두 강력 새로고침(`Ctrl + F5` 또는 캐시 비우기)하여 최신 코드를 로드합니다.

### Step 2. 실시간 좋아요 증감 동기화 최종 검증
* **로그인 상태 확인**: `스타크` 계정과 `멀린` 계정으로 각각 로그인합니다. (로그인 후 자신의 좋아요 상태가 정확히 빨간 하트로 로드되는지 확인)
* **상호 작용 테스트**:
  - A브라우저(`스타크`)에서 좋아요를 누르면, B브라우저(`멀린`) 피드 카드에 하트 숫자가 즉시 `1` 증가하는지 확인합니다.
  - B브라우저에서 좋아요를 누르고 해제할 때, A브라우저의 숫자가 실시간으로 즉시 오르고 내리는지 확인합니다.
  - 콘솔에 `Uncaught ReferenceError` 또는 다른 오류가 추가로 발생하는지 감시합니다.
