# 허브 패밀리 vs 왓잇 패밀리 — 완전 분리 구조

## 핵심 원칙
> **"왓잇 가족방 = 왓잇 전용. 허브와 데이터 공유 없음"**

---

## 비교표

| 항목 | 허브(Merlin Hub) 패밀리 | 왓잇(WhatEat) 가족방 |
|---|---|---|
| **목적** | 멀린 전체 앱 공통 추천/보상 | 왓잇 전용 "먹자 가족" |
| **DB 위치** | 허브 Supabase (`family_users`) | 왓잇 Supabase (`family_groups`, `family_members`) |
| **관리 주체** | 멀린 허브 | 왓잇 앱 자체 |
| **가족 이름** | 없음 (허브엔 가족 이름 개념 없음) | 왓잇 DB에 저장 (e.g. "스타크 가족") |
| **가족 사진** | 없음 | 왓잇 DB `family_groups.family_photo` |
| **멤버 관리** | 허브 API | 왓잇 `family_members` 테이블 |

---

## 초대 링크 구조

```
https://whateat.sundreamer.app/?ref=7F6J5HSG&family=방장UUID
```

| 파라미터 | 코드 주인 | 용도 | 처리 위치 |
|---|---|---|---|
| `ref=7F6J5HSG` | 허브 개인 추천 코드 | 허브 보상/통계용 | `registerInviter()` → 허브 API |
| `family=방장UUID` | 왓잇 방장 user.id | 왓잇 가족방 연결 | `/api/family/join` → 왓잇 DB |

---

## 수락 처리 순서 (WhatEatApp.handleAcceptFamilyJoin)

```
1. registerInviter(ref코드)  → 허브에만 영향 (보상/통계)
2. POST /api/family/join     → 왓잇 DB만 영향
   └─ family_groups: 방장 가족 생성 (없으면)
   └─ family_members: 방장(owner) + 나(member) 추가
```

두 처리는 **독립적**. 하나가 실패해도 다른 건 영향 없음.

---

## 왓잇 DB 스키마 (가족 관련)

```sql
family_groups
  id          uuid  PK
  owner_id    uuid  → users.id (방장)
  name        varchar  (e.g. "스타크 가족")
  family_photo text
  created_at

family_members
  id          uuid  PK
  family_id   uuid  → family_groups.id
  user_id     uuid  → users.id
  role        varchar  ('owner' | 'member')
  joined_at
```

---

## 핵심 코드 위치

| 파일 | 역할 |
|---|---|
| `src/app/api/family/join/route.ts` | 초대 수락 → 왓잇 DB 저장 |
| `src/app/api/family/members/route.ts` | 가족 멤버 목록 조회 |
| `src/components/whateat/WhatEatApp.tsx` | URL 파라미터 감지, 수락 팝업 처리 |
| `src/components/whateat/family-page.tsx` | 가족 탭 UI, 초대 링크 생성 |

---

## 주의사항

- 허브 `referrals` 테이블은 **왓잇 가족방과 무관**
- 초대 팝업은 URL에 **`family=UUID` 파라미터가 있을 때만** 노출
- `ref=` 파라미터만 있는 기존 링크는 가족 팝업 미노출 (허브 전용)
- 가족 데이터는 **왓잇 DB에만** 존재
