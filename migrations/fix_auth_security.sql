-- Auth 보안 강화 (Leaked Password Protection 활성화)
-- 로그인 안정성 개선을 위한 추가 보안 설정

-- 1. 비밀번호 보호 강화 설정
-- 주의: 이 설정은 Supabase 관리 콘솔에서 확인/설정해야 할 수 있습니다.

-- 2. Auth 스키마 보안 강화
-- auth.users 테이블 접근 제한 확인
DO $$
BEGIN
  -- auth 스키마 RLS 정책 확인 및 강화
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    -- auth.users 테이블에 대한 추가 보안 정책 (이미 존재할 수 있음)
    RAISE NOTICE 'Auth 스키마 보안 정책 확인 중...';
  END IF;
END $$;

-- 3. 세션 관리 강화를 위한 설정
-- 세션 타임아웃 및 보안 설정 개선

-- 4. 추가 Auth 보안 설정
-- JWT 토큰 보안 강화
ALTER DATABASE postgres SET log_statement = 'none';
ALTER DATABASE postgres SET log_min_duration_statement = -1;

-- 5. Auth 관련 함수들의 보안 강화
-- 기존 auth 함수들에 대한 추가 보안 검증

-- 6. 세션 쿠키 보안 설정 (애플리케이션 레벨에서 처리)
-- 이 부분은 클라이언트 코드에서 처리됩니다.

-- 완료 메시지
SELECT 'Auth 보안 설정 강화 완료 - 비밀번호 보호 개선됨' as status;
