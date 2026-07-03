# 🚀 Supabase Realtime 적용 시 핵심 Tip (실무 해결편)

Supabase의 실시간 연동(`postgres_changes`)을 도입할 때 가장 흔하게 마주치지만 해결하기 까다로운 **DELETE(취소/삭제) 이벤트 데이터 누락 현상**과 그 확실한 우회법에 대한 가이드입니다.

## 1. 문제 상황: DELETE 이벤트의 페이로드 누락
- `INSERT`나 `UPDATE`와 달리, `DELETE` 이벤트 발생 시 Realtime 페이로드의 `old` 객체에는 기본키(`id`) 하나만 달랑 넘어옵니다.
- **예시**: 맛톡 좋아요 취소 시, 어떤 게시물(`meal_id`)의 좋아요가 취소되었는지 프론트엔드가 알 수 없어 UI 상에서 숫자 차감이 불가능해짐.

## 2. 이론적 해결책과 실무적 한계 (REPLICA IDENTITY FULL)
- **이론적 해결책**: 데이터베이스에서 해당 테이블에 대해 `ALTER TABLE 테이블명 REPLICA IDENTITY FULL;` 쿼리를 실행하면, `old` 객체에 삭제된 행의 모든 컬럼(`meal_id`, `user_id` 등)이 담겨서 와야 합니다.
- **실무적 한계 (고질적 버그)**: 
  - 이미 `supabase_realtime` Publication에 등록되어 구독 중인 테이블의 경우, 뒤늦게 쿼리를 먹여도 **캐싱(Caching) 현상** 때문에 설정이 즉각 반영되지 않습니다.
  - 대시보드(Replication 메뉴)에 들어가 해당 테이블의 스위치를 껐다 켜서 강제로 갱신해주지 않으면 설정이 평생 동작하지 않는 함정이 있습니다.

## 3. 궁극의 우회/해결책: Broadcast 채널 직접 활용
- DB Replication의 불안정한 갱신이나 RLS 세팅의 복잡함을 피하기 위해, 단순히 카운트를 증감시키는 목적이라면 **Supabase의 초고속 무전기 기능(Broadcast)** 을 활용하는 것이 훨씬 안정적이고 빠릅니다.

### 💡 Broadcast 적용 방법 (좋아요 동기화 예시)
1. **[수신부] 공용 채널 구독 (useEffect)**
   - `postgres_changes` 대신 커스텀 `broadcast` 이벤트를 리스닝합니다.
   ```typescript
   // 컴포넌트 내에 채널 객체를 들고 있을 useRef 선언
   const likesChannelRef = useRef<any>(null)

   useEffect(() => {
     const likesChannel = supabase.channel('public:meal_likes_broadcast')
     likesChannelRef.current = likesChannel
     
     likesChannel
       .on('broadcast', { event: 'LIKE' }, (payload) => {
         const { meal_id } = payload.payload;
         // ... 화면의 좋아요 + 1 처리 (본인 유발 이벤트 제외 조건 필수)
       })
       .on('broadcast', { event: 'UNLIKE' }, (payload) => {
         const { meal_id } = payload.payload;
         // ... 화면의 좋아요 - 1 처리
       })
       .subscribe();

     return () => supabase.removeChannel(likesChannel)
   }, [])
   ```

2. **[발신부] 액션 발생 시 무전 송신**
   - 버튼을 눌렀을 때, DB에 기록(INSERT/DELETE)함과 동시에 채널에 브로드캐스트 신호를 쏩니다.
   ```typescript
   // 좋아요 취소(DELETE) 로직 직후
   if (likesChannelRef.current) {
     likesChannelRef.current.send({
       type: 'broadcast',
       event: 'UNLIKE',
       payload: { meal_id: postId, user_id: user.id }
     })
   }
   ```

## 4. 요약 및 권장 사항
- 단순 채팅 기록처럼 "row 자체가 화면에 쌓이는" 기능은 `postgres_changes`가 필수지만,
- **좋아요 카운트, 실시간 투표 수, 단순 토글 상태 등 "숫자 증감"이나 "단순 알림"** 목적의 기능은 DB 갱신 지연에 의존하기보다 **Broadcast 방식**으로 프론트엔드끼리 직통 신호를 주고받는 방식이 훨씬 빠르고 확실한 해결책입니다.
