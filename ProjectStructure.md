# 급식 배틀 프로젝트 구조 및 기능 문서

**버전**: 1.0.0  
**최종 업데이트**: 2025-05-22

## 목차
1. [프로젝트 구조 개요](#프로젝트-구조-개요)
2. [주요 폴더 및 파일](#주요-폴더-및-파일)
3. [컴포넌트 (Components)](#컴포넌트-components)
4. [훅 (Hooks)](#훅-hooks)
5. [API 엔드포인트](#api-엔드포인트)
6. [유틸리티 및 헬퍼](#유틸리티-및-헬퍼)
7. [주요 기능](#주요-기능)
8. [데이터베이스 스키마](#데이터베이스-스키마)

## 프로젝트 구조 개요

```
eat-meal-battle/
├── apps/                         # 애플리케이션 모음
│   ├── app/                      # 메인 웹 애플리케이션
│   │   ├── src/
│   │   │   ├── app/              # Next.js 앱 라우터
│   │   │   │   ├── api/          # API 엔드포인트
│   │   │   │   │   ├── auth/     # 인증 관련 API
│   │   │   │   │   ├── meal-images/ # 급식 이미지 API
│   │   │   │   │   └── meals/    # 급식 정보 API
│   │   │   │   ├── (routes)/     # 페이지 라우트
│   │   │   │   └── layout.tsx    # 루트 레이아웃
│   │   │   ├── components/       # 재사용 가능한 컴포넌트
│   │   │   ├── hooks/            # 커스텀 훅
│   │   │   ├── lib/              # 라이브러리 및 유틸리티
│   │   │   ├── types/            # 타입 정의
│   │   │   └── utils/            # 유틸리티 함수
│   └── whateat/                  # 부가 애플리케이션
├── packages/                     # 공유 패키지
│   ├── auth/                     # 인증 관련 패키지
│   ├── types/                    # 타입 정의 패키지 
│   ├── ui/                       # UI 컴포넌트 패키지
│   └── utils/                    # 유틸리티 함수 패키지
└── types/                        # 전역 타입
```

## 주요 폴더 및 파일

### apps/app/src/app/
Next.js 앱 라우터를 사용한 페이지 및 API 라우트가 위치합니다.

#### apps/app/src/app/page.tsx
- **설명**: 메인 홈페이지
- **기능**: 오늘의 급식 정보 표시, 날짜 선택, 학교 선택, 이미지 업로드
- **주요 컴포넌트**: HomePage, DateSelector, MealList

#### apps/app/src/app/profile/page.tsx
- **설명**: 사용자 프로필 페이지
- **기능**: 프로필 정보 수정, 학교 변경, 닉네임 변경
- **주요 컴포넌트**: ProfilePage, SchoolSelector, ProfileForm

#### apps/app/src/app/api/meals/route.ts
- **설명**: 급식 정보 API 엔드포인트
- **메서드**:
  - GET: 날짜와 학교 코드로 급식 정보 조회
  - POST: 새로운 급식 정보 등록 (관리자용)

#### apps/app/src/app/api/meal-images/route.ts
- **설명**: 급식 이미지 관리 API 엔드포인트
- **메서드**:
  - POST: 이미지 업로드 및 저장
  - GET: 특정 급식의 이미지 목록 조회

#### apps/app/src/app/api/auth/route.ts
- **설명**: 인증 관련 API 엔드포인트
- **메서드**:
  - POST: 로그인, 회원가입, 로그아웃 처리

### apps/app/src/components/
재사용 가능한 UI 컴포넌트가 위치합니다.

#### MealCard.tsx
- **설명**: 급식 정보를 카드 형태로 표시하는 컴포넌트
- **함수 및 컴포넌트**:
  - `MealCard({ meal, onImageUpload })`: 급식 카드 컴포넌트
  - `getMealTypeIcon(mealType)`: 급식 타입에 따른 아이콘 반환
  - `handleRating(value)`: 별점 처리 함수
  - `fetchRating(menuItemId)`: 평점 조회 함수

#### MealImageUploader.tsx
- **설명**: 급식 이미지 업로드 컴포넌트
- **함수 및 컴포넌트**:
  - `MealImageUploader({ mealId })`: 이미지 업로드 UI 컴포넌트
  - `handleFileChange(event)`: 파일 선택 처리
  - `handleUpload(file)`: 파일 업로드 함수
  - `verifyImage(imageUrl)`: AI 이미지 검증 함수
  - `handleDeleteImage(imageId)`: 이미지 삭제 함수

#### AppHeader.tsx
- **설명**: 앱 상단 헤더 컴포넌트
- **함수 및 컴포넌트**:
  - `AppHeader()`: 메인 헤더 컴포넌트
  - `UserMenu()`: 사용자 메뉴 컴포넌트

#### NotificationBell.tsx
- **설명**: 알림 아이콘 및 드롭다운 컴포넌트
- **함수 및 컴포넌트**:
  - `NotificationBell()`: 알림 아이콘 컴포넌트
  - `fetchNotifications()`: 알림 목록 조회 함수
  - `markAsRead(notificationId)`: 알림 읽음 처리 함수

### apps/app/src/hooks/
React 커스텀 훅이 위치합니다.

#### useMeals.ts
- **설명**: 급식 정보를 관리하는 커스텀 훅
- **함수**:
  - `useMeals(date, schoolCode)`: 급식 데이터 훅
  - `fetchMealInfo(date, schoolCode)`: 급식 데이터 조회 함수

#### useUserSchool.ts
- **설명**: 사용자 학교 정보를 관리하는 커스텀 훅
- **함수**:
  - `useUserSchool()`: 학교 정보 관리 훅
  - `updateUserSchool(schoolCode, schoolName)`: 학교 정보 업데이트 함수

#### useAuth.ts
- **설명**: 사용자 인증 상태를 관리하는 커스텀 훅
- **함수**:
  - `useAuth()`: 인증 상태 관리 훅
  - `signIn(email, password)`: 로그인 함수
  - `signOut()`: 로그아웃 함수
  - `signUp(email, password, nickname)`: 회원가입 함수

### apps/app/src/utils/
유틸리티 함수들이 위치합니다.

#### date.ts
- **설명**: 날짜 관련 유틸리티 함수
- **함수**:
  - `formatDate(date, format)`: 날짜 포맷팅 함수
  - `getWeekRange(date)`: 주간 범위 계산 함수
  - `isWeekend(date)`: 주말 여부 확인 함수

#### image.ts
- **설명**: 이미지 처리 유틸리티 함수
- **함수**:
  - `resizeImage(file, maxWidth, maxHeight)`: 이미지 크기 조정 함수
  - `compressImage(file, quality)`: 이미지 압축 함수
  - `dataURLtoFile(dataurl, filename)`: DataURL을 File 객체로 변환

### apps/app/src/lib/
라이브러리 및 외부 서비스 통합 코드가 위치합니다.

#### supabase.ts
- **설명**: Supabase 클라이언트 및 유틸리티
- **함수 및 객체**:
  - `createClientComponentClient()`: 클라이언트용 Supabase 인스턴스 생성
  - `createServerComponentClient()`: 서버용 Supabase 인스턴스 생성

#### firebase.ts
- **설명**: Firebase 설정 및 유틸리티
- **함수 및 객체**:
  - `initializeFirebase()`: Firebase 초기화
  - `getMessaging()`: FCM 인스턴스 가져오기
  - `requestPermission()`: 알림 권한 요청

## 컴포넌트 (Components)

### MealCard
**경로**: `apps/app/src/components/MealCard.tsx`
**설명**: 급식 정보를 시각적으로 표현하는 카드 컴포넌트
**주요 기능**:
- 급식 메뉴 항목 표시
- 급식 이미지 표시
- 별점 평가 기능
- 이미지 업로드 버튼 제공

### MealImageUploader
**경로**: `apps/app/src/components/MealImageUploader.tsx`
**설명**: 급식 이미지 업로드 컴포넌트
**주요 기능**:
- 이미지 파일 선택
- 이미지 업로드 및 저장
- AI를 통한 이미지 검증
- AI 이미지 자동 생성

### StarRating
**경로**: `apps/app/src/components/StarRating.tsx`
**설명**: 별점 입력 및 표시 컴포넌트
**주요 기능**:
- 1~5점 별점 표시
- 별점 입력 기능
- 읽기 전용 모드 지원

### NotificationBell
**경로**: `apps/app/src/components/NotificationBell.tsx`
**설명**: 알림 아이콘 및 목록 컴포넌트
**주요 기능**:
- 새 알림 표시
- 알림 목록 드롭다운
- 알림 읽음 처리

### FirebaseMessaging
**경로**: `apps/app/src/components/firebase/FirebaseMessaging.tsx`
**설명**: Firebase 푸시 알림 관리 컴포넌트
**주요 기능**:
- FCM 토큰 관리
- 알림 권한 요청
- 푸시 알림 수신 및 처리

## 훅 (Hooks)

### useMeals
**경로**: `apps/app/src/hooks/useMeals.ts`
**설명**: 급식 정보를 관리하는 커스텀 훅
**주요 기능**:
- 날짜와 학교 코드로 급식 정보 조회
- 로딩 상태 관리
- 오류 처리
- 데이터 재조회 기능

### useUserSchool
**경로**: `apps/app/src/hooks/useUserSchool.ts`
**설명**: 사용자 학교 정보를 관리하는 커스텀 훅
**주요 기능**:
- 현재 사용자의 학교 코드 및 이름 조회
- 학교 정보 업데이트
- 로컬 스토리지 캐싱

### useAuth
**경로**: `packages/auth/src/hooks/useAuth.ts`
**설명**: 사용자 인증 상태를 관리하는 커스텀 훅
**주요 기능**:
- 로그인 상태 관리
- 로그인/로그아웃 기능
- 사용자 정보 조회
- 회원가입 기능

### useNotifications
**경로**: `apps/app/src/hooks/useNotifications.ts`
**설명**: 사용자 알림을 관리하는 커스텀 훅
**주요 기능**:
- 알림 목록 조회
- 읽지 않은 알림 개수 계산
- 알림 읽음 처리
- 실시간 알림 업데이트

## API 엔드포인트

### /api/meals
**경로**: `apps/app/src/app/api/meals/route.ts`
**설명**: 급식 정보 관리 API
**메서드**:
- **GET**: 특정 날짜와 학교의 급식 정보 조회
  - 요청 파라미터: ?date=YYYY-MM-DD&schoolCode=string
  - 응답: 급식 정보 배열
- **POST**: 새로운 급식 정보 등록 (관리자 전용)
  - 요청 본문: { schoolCode, mealDate, mealType, menuItems }
  - 응답: { success: boolean, id: string }

### /api/meal-images
**경로**: `apps/app/src/app/api/meal-images/route.ts`
**설명**: 급식 이미지 관리 API
**메서드**:
- **POST**: 이미지 업로드 처리
  - 요청 본문: multipart/form-data (파일 및 mealId 포함)
  - 응답: { success: boolean, url: string }
- **GET**: 특정 급식의 이미지 목록 조회
  - 요청 파라미터: ?mealId=string
  - 응답: 이미지 정보 배열

### /api/auth
**경로**: `apps/app/src/app/api/auth/route.ts`
**설명**: 인증 관리 API
**메서드**:
- **POST /signin**: 로그인 처리
  - 요청 본문: { email, password }
  - 응답: { user, session }
- **POST /signup**: 회원가입 처리
  - 요청 본문: { email, password, nickname }
  - 응답: { user, session }
- **POST /signout**: 로그아웃 처리
  - 응답: { success: boolean }

## 유틸리티 및 헬퍼

### date.ts
**경로**: `apps/app/src/utils/date.ts`
**설명**: 날짜 관련 유틸리티 함수
**주요 함수**:
- `formatDate(date, format)`: 날짜를 지정된 형식으로 포맷팅
- `getWeekRange(date)`: 특정 날짜가 속한 주의 시작일과 종료일 계산
- `getMonthDays(year, month)`: 특정 월의 모든 날짜 배열 반환
- `isWeekend(date)`: 주말 여부 확인
- `getKoreanWeekdayName(date)`: 한글 요일명 반환

### image.ts
**경로**: `apps/app/src/utils/image.ts`
**설명**: 이미지 처리 유틸리티 함수
**주요 함수**:
- `getImageUrl(path)`: Supabase Storage 이미지 URL 생성
- `resizeImage(file, maxWidth, maxHeight)`: 이미지 크기 조정
- `compressImage(file, quality)`: 이미지 압축
- `dataURLtoFile(dataurl, filename)`: Data URL을 File 객체로 변환
- `getFileExtension(filename)`: 파일 확장자 가져오기

### mealUpdater.ts
**경로**: `apps/app/src/lib/mealUpdater.ts`
**설명**: 급식 정보 업데이트 유틸리티
**주요 함수**:
- `fetchMealFromNEIS(schoolCode, startDate, endDate)`: NEIS API에서 급식 정보 가져오기
- `updateMealDatabase(meals)`: 가져온 급식 정보를 DB에 업데이트
- `parseMenuItems(menuText)`: 급식 메뉴 텍스트 파싱
- `scheduleNextUpdate()`: 다음 업데이트 시간 예약

## 데이터베이스 스키마

### users
**설명**: 사용자 정보 테이블
**컬럼**:
- `id`: UUID (PK)
- `email`: 이메일
- `nickname`: 닉네임
- `school_code`: 학교 코드
- `school_name`: 학교 이름
- `created_at`: 계정 생성 시간

### meal_menus
**설명**: 급식 정보 테이블
**컬럼**:
- `id`: UUID (PK)
- `school_code`: 학교 코드
- `meal_date`: 급식 날짜
- `meal_type`: 급식 타입 (조식, 중식, 석식)
- `menu_items`: 메뉴 항목 (JSONB)

### meal_images
**설명**: 급식 이미지 테이블
**컬럼**:
- `id`: UUID (PK)
- `meal_id`: 급식 ID (FK)
- `image_url`: 이미지 URL
- `uploaded_by`: 업로드한 사용자 ID
- `status`: 이미지 상태 (pending, approved, rejected, auto-generated)

### menu_item_ratings
**설명**: 메뉴 항목 별점 테이블
**컬럼**:
- `id`: UUID (PK)
- `menu_item_id`: 메뉴 항목 ID
- `user_id`: 사용자 ID
- `rating`: 별점 (1-5)
- `created_at`: 평가 생성 시간

### notifications
**설명**: 사용자 알림 테이블
**컬럼**:
- `id`: UUID (PK)
- `user_id`: 사용자 ID
- `title`: 알림 제목
- `message`: 알림 내용
- `read`: 읽음 여부
- `created_at`: 알림 생성 시간
