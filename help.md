# WhatEat 가족 페이지 (family-page.tsx) 좋아요 및 댓글 디버깅 요청서

외부 AI님, 현재 WhatEat 애플리케이션의 가족 페이지(`family-page.tsx`)에서 위시리스트 및 예약 카드의 **댓글 저장 및 좋아요 실시간 동기화**에 심각한 버그가 있어 지원을 요청합니다.

## 🚨 발생 중인 문제 증상
1. **위시리스트/예약 카드 댓글 증발 문제**
   - 사용자가 위시리스트 카드에서 댓글을 입력하고 저장 버튼을 누르면 입력창의 글자가 사라지지만, **댓글이 화면에 나타나지 않으며 DB에도 정상적으로 반영/유지되지 않는 현상**이 발생하고 있습니다.
2. **좋아요 실시간 동기화 불량 (먹통)**
   - 위시리스트/예약 카드의 좋아요(하트) 버튼을 누르면 실시간으로 다른 가족 멤버의 화면에 동기화되어야 하나, 작동하지 않으며 먹통이 되는 현상이 지속되고 있습니다.

---

## 🏗️ 시스템 아키텍처 및 배경지식
- **인증(Auth)**: 본 앱은 Supabase Auth를 직접 사용하지 않고 Merlin Hub 서버를 통해 자체 세션 토큰을 발급받아 인증합니다. 프론트엔드는 주로 `anon` 키를 사용하므로 DB의 RLS는 인증된 사용자(Supabase Auth)가 아닌 `anon` 접근을 열어두거나 API 라우트를 통해 우회하여 데이터를 쓰도록 설계되어 있습니다.
- **데이터 쓰기 (`secureWrite`)**: RLS 문제를 회피하기 위해 클라이언트에서는 `src/lib/supabase-safe.ts`의 `secureWrite` 함수를 호출하여 Next.js 서버의 `src/app/api/db/write/route.ts` (API 라우트)에서 `supabaseAdmin` 권한으로 DB에 접근하여 데이터를 삽입/수정/삭제합니다.
- **실시간 구독 (Supabase Realtime)**: `family-page.tsx` 내에서 `supabase.channel('realtime:family_sync:...')`을 열고 `postgres_changes` 이벤트를 수신하여 테이블(`comments`, `meal_likes` 등)에 변화가 생기면 데이터를 리패치합니다.

---

## 🔍 관련 핵심 코드 분석
### 1. 데이터 가져오기 로직 (`fetchFamilyData` vs `fetchFamilyReservations`)
가족 페이지는 두 종류의 식사 데이터를 서로 다른 함수로 가져옵니다.
- `fetchFamilyData`: `meal_images` (완료된 식사 기록)를 가져오고, 여기에 달린 댓글을 가져와 `mealComments` 상태(State)에 `setMealComments`로 주입합니다.
- `fetchFamilyReservations`: `meal_reservations` (위시리스트 및 계획된 식사)를 가져오고, 여기에 달린 `comments`와 `meal_likes`를 가져옵니다. 이때 가져온 댓글은 `setMealComments(prev => ({...prev, ...commentsMap}))` 방식으로 기존 상태에 병합하고, 좋아요는 `setWishlistLikes(likesMap)`으로 상태에 주입합니다.

### 2. 댓글 작성 로직 (`handleAddMealComment`)
```typescript
const handleAddMealComment = async (mealId: string | number) => {
  // ... (id 탐색 로직 생략)
  const commentUuid = generateUUID()
  await secureWrite({
    table: 'comments',
    action: 'insert',
    data: { id: commentUuid, meal_id: commentTargetId, user_id: user.id, content: content, is_deleted: false }
  })
  // 작성 후 리패치
  await fetchFamilyData(familyUserIds)
  await fetchFamilyReservations(familyUserIds)
  setMealCommentInput("")
}
```
**문제 가설 1 (Race Condition)**: 
`secureWrite`로 댓글을 인서트하는 순간 Supabase Realtime이 발동하여 `fetchFamilyData`와 `fetchFamilyReservations`가 **백그라운드에서 실행**됩니다. 동시에 `handleAddMealComment`에서도 두 함수를 순차적으로 `await`하며 재실행합니다. 이 과정에서 `fetchFamilyData`가 상태를 덮어씌우거나, 비동기 업데이트 순서가 꼬이면서 위시리스트용 댓글 상태가 초기화(증발)될 가능성이 의심됩니다. (이전 수정에서 `setMealComments(prev => ({...prev, ...commentsByMealId}))`로 병합하도록 조치했으나 여전히 해결되지 않음)

**문제 가설 2 (Target ID 불일치)**:
위시리스트의 카드는 `meal_reservations`의 `id`를 가집니다. `commentTargetId`로 `targetMeal.mealMenuId || targetMeal.id`를 사용하여 `comments` 테이블의 `meal_id`에 저장합니다. 데이터를 불러올 때 `in("meal_id", allResIds)`로 올바르게 매핑되는지 검증이 필요합니다.

### 3. 좋아요 로직 (`handleToggleWishlistLike`)
```typescript
const handleToggleWishlistLike = async (itemId: string | number) => {
  const likedUsers = wishlistLikes[itemId] || []
  const hasLiked = likedUsers.includes(user.id)
  
  if (hasLiked) {
    setWishlistLikes(prev => ({...prev, [itemId]: likedUsers.filter(uid => uid !== user.id)})) // 낙관적 업데이트
    await secureWrite({ table: "meal_likes", action: "delete", filters: { meal_id: itemId } })
  } else {
    setWishlistLikes(prev => ({...prev, [itemId]: [...likedUsers, user.id]})) // 낙관적 업데이트
    await secureWrite({ table: "meal_likes", action: "insert", data: { meal_id: itemId, user_id: user.id } })
  }
}
```
**문제 가설 (Realtime 동기화 누락 및 충돌)**:
좋아요를 누르면 낙관적 업데이트로 로컬 상태는 변하지만, DB에 쓰인 후 Supabase Realtime 리스너가 다른 클라이언트에게 이벤트를 브로드캐스트할 때 `fetchFamilyReservations`가 호출됩니다. 
하지만 이 과정에서 `likesData`를 성공적으로 읽어오지 못하거나 (`anon` 클라이언트의 RLS 문제?), 혹은 가져온 `likesData`가 React 상태에 제대로 덮어씌워지지 않아 실시간 반영(Realtime)이 되지 않는 것으로 추정됩니다. 중복 키(Duplicate Key) 에러를 방지하기 위해 낙관적 업데이트를 적용했음에도 "먹통" 현상이 발생하고 있습니다.

---

## 🛠️ 검토 및 수정이 필요한 사항
외부 AI님께서는 다음 사항을 집중적으로 분석하여 코드를 수정해 주시기 바랍니다.

1. **상태 관리 꼬임 해결 (Race Condition)**: 
   `fetchFamilyData`와 `fetchFamilyReservations`가 동일한 `mealComments` 상태(State)를 비동기적으로 업데이트하면서 발생하는 충돌과 덮어씌워짐 현상을 완벽하게 분리하거나 안전하게 통합할 수 있는 아키텍처 재설계.
2. **Realtime 리스너 로직 개선**:
   `comments` 및 `meal_likes` 테이블의 Realtime 이벤트 발생 시 전체 데이터를 무식하게 리패치(`fetchFamilyReservations`)하는 과정에서 일어나는 성능 저하 및 상태 초기화 문제를 막기 위해, payload를 분석하여 필요한 로컬 상태만 타겟팅하여 업데이트하도록 최적화할 것.
3. **secureWrite 삽입 후 조회 흐름 검증**:
   위시리스트 카드(예: `meal_reservations` 기반 항목)의 댓글과 좋아요가 `meal_id` 외래키를 통해 정확하게 저장되고 다시 Select 될 때 데이터가 누락되지 않는지, API Route(`route.ts`)의 권한/조회 필터 로직에 허점이 없는지 점검.
