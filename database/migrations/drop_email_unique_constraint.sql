-- users 테이블의 email 컬럼 유니크 제약조건(Unique Constraint) 삭제
-- Merlin Hub인증을 통해 발급되는 UUID가 절대적인 고유 식별자(PK)이므로,
-- 로컬 앱 DB 레벨에서 이메일 중복 제약조건을 강제할 필요가 없으며,
-- 오히려 동일 이메일의 세션 교체/재등록 시 로그인 및 데이터 동기화를 방해하므로 삭제합니다.

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;
