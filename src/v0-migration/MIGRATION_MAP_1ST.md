# v0 1차 재분류 매핑표 (안전 모드)

원칙: `src/v0-migration` 원본은 삭제/이동하지 않고 유지한다.

## 1) 메뉴 분류 기준

- `main-menu/menu-1`: 솔로(먹로그/먹예약/먹캘린더) 중심 화면
- `main-menu/menu-2`: 패밀리 관련 화면
- `main-menu/menu-3`: 맛톡/피드 관련 화면
- `school-battle/meal`: 급식 서브메뉴(현재 v0는 준비중 UI 수준)
- `shared/common`: 공통 레이아웃/헤더/푸터/모달/UI 유틸

## 2) 파일 매핑 (v0 기준)

### menu-1 후보
- `components/whateat/meal-log-tab.tsx`
- `components/whateat/reservation-tab.tsx`
- `components/whateat/meal-calendar-tab.tsx`
- `components/whateat/add-log-modal.tsx`
- `components/whateat/add-reservation-modal.tsx`

### menu-2 후보
- `components/whateat/family-page.tsx`

### menu-3 후보
- `components/whateat/talk-page.tsx`
- `components/whateat/feed-tab.tsx`
- `components/whateat/.backup-talk-page.tsx`
- `components/whateat/.backup-feed-tab.tsx`

### school-battle/meal 후보
- `app/page.tsx` 내 `renderMealPage` 블록 (준비중 UI)

### shared/common 후보
- `components/whateat/header.tsx`
- `components/whateat/tab-navigation.tsx`
- `components/whateat/bottom-nav.tsx`
- `components/whateat/floating-action-button.tsx`
- `components/whateat/footer.tsx`
- `components/whateat/image-viewer.tsx`
- `components/theme-provider.tsx`
- `components/ui/*`
- `hooks/use-mobile.ts`
- `hooks/use-toast.ts`
- `lib/utils.ts`

## 3) 다음 단계

1. 이 매핑표를 기준으로 2차 재분류(실제 복사 배치) 진행
2. import 경로를 `@/` 기준으로 정리
3. `src/app` 라우트 연결은 마지막 단계에서 진행
