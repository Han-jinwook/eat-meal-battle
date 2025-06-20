# 개발 노트: 모노레포 구조 제거 및 앱 리브랜딩 계획

## 📌 프로젝트 목표
- 프로젝트명: "뭐먹지?"(WhatEat)
- 기존 '급식배틀' 앱을 기반으로 리브랜딩
- 모노레포 구조 제거하여 개발 환경 단순화
- 외부 서비스 연결(Supabase, GitHub 등)은 유지

## 📋 단계별 실행 계획

### 1️⃣ 준비 작업 (1일)
- [ ] 현재 코드베이스 전체 백업 (브랜치: `backup-monorepo`)
- [ ] 필수 파일 및 디렉토리 목록 작성
- [ ] 의존성 맵 작성

### 2️⃣ 모노레포 구조 제거 (2-3일)
- [ ] `apps/app` 디렉토리 내용을 루트로 이전
```bash
# 새 브랜치 생성
git checkout -b simplified-structure

# 필요한 파일 루트로 복사
mkdir -p temp_root/src
cp -r apps/app/src/* temp_root/src/
cp apps/app/package.json temp_root/
cp apps/app/next.config.js temp_root/
cp apps/app/.env* temp_root/ 2>/dev/null || true

# 루트 디렉토리로 이동
mv temp_root/* .
rm -rf temp_root
```

- [ ] 불필요한 모노레포 파일 제거
```bash
rm -rf turbo.json pnpm-workspace.yaml
```

- [ ] package.json 수정 (이름 유지, 의존성 정리)
```json
{
  "name": "eat-meal-battle", 
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@supabase/supabase-js": "^2.38.4"
  }
}
```

### 3️⃣ 설정 파일 조정 (1-2일)
- [ ] Next.js 설정 파일 위치 조정
- [ ] 환경 변수 파일 확인 및 조정
- [ ] 빌드 및 배포 스크립트 수정
- [ ] 경로 참조 수정 (필요시)

### 4️⃣ 앱 리브랜딩 (UI 레벨) (1-2일)
- [ ] 앱 내부 이름 변경: "급식배틀" → "뭐먹지?"
- [ ] 로고 및 아이콘 변경
- [ ] 관련 텍스트 및 메타데이터 업데이트

### 5️⃣ 테스트 및 검증 (2일)
- [ ] 로컬 개발 환경 테스트
```bash
npm install
npm run dev
```
- [ ] 모든 기능 정상 작동 확인 체크리스트:
  - [ ] 로그인/인증
  - [ ] 급식 정보 표시
  - [ ] 이미지 업로드/표시
  - [ ] 별점 기능
  - [ ] 기타 핵심 기능
- [ ] 외부 서비스 연결 검증 (Supabase 등)

### 6️⃣ 배포 및 출시 준비 (1-2일)
- [ ] 빌드 테스트
```bash
npm run build
```
- [ ] 배포 테스트
- [ ] 출시 자료 준비

## 🔍 주의사항 및 체크포인트

### 경로 참조 확인
- `import` 문에서 내부 모듈 참조 경로 확인
- 절대 경로 설정 확인 (`jsconfig.json` 또는 `tsconfig.json`)

### 환경 변수 확인
- `.env` 파일 위치 및 내용 확인
- Supabase, OpenAI 등 API 키 설정 확인

### 의존성 관리
- 모노레포에서 공유하던 의존성 확인
- 필요한 모든 의존성이 메인 package.json에 포함되었는지 확인

### 빌드 설정
- Next.js 설정 파일 위치 및 내용 확인
- 빌드 스크립트 작동 확인

## 🛠️ 문제 해결 전략

### 경로 문제 발생 시
- `jsconfig.json` 또는 `tsconfig.json`에서 경로 별칭 설정 확인
- 상대 경로로 임시 변경 후 테스트

### 빌드 실패 시
- 누락된 의존성 확인 및 설치
- 빌드 로그 확인하여 구체적인 오류 해결

### 외부 서비스 연결 문제
- 환경 변수 설정 확인
- API 키 및 인증 정보 재확인

## 📝 향후 계획
1. 앱 출시 후 사용자 피드백 수집
2. "뭐먹지" 추천 기능 점진적 추가
3. UI/UX 개선 및 최적화
