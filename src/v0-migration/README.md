# v0 Migration Staging

이 폴더는 `v0` 코드 이관 전용 임시 스테이징 경로입니다.

## 구조
- `main-menu/menu-1`: 뭐먹지 메인 기능 1
- `main-menu/menu-2`: 뭐먹지 메인 기능 2
- `main-menu/menu-3`: 뭐먹지 메인 기능 3
- `school-battle/meal`: 급식 서브메뉴
- `school-battle/battle`: 배틀 서브메뉴
- `school-battle/quiz`: 퀴즈 서브메뉴
- `shared/auth`: 인증 관련 공통 코드
- `shared/common`: 공용 컴포넌트/유틸

## 이관 원칙
1. 페이지 컴포넌트보다 비즈니스 로직/훅/유틸을 먼저 이동
2. import 경로를 상대경로가 아닌 alias(`@/...`) 기준으로 정리
3. 라우트 연결(`src/app`)은 이관 완료 후 마지막에 진행
