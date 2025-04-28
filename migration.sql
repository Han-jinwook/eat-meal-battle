-- 기존 제약 조건 제거
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_school_info_id_fkey;

-- school_infos 테이블 수정: 
-- 1. id를 UUID에서 user_id로 변경 
-- 2. user_id를 기본 키로 설정
-- 3. users 테이블과의 외래 키 관계 설정

-- 임시 테이블 생성하여 기존 데이터 유지
CREATE TABLE school_infos_new (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_code TEXT,
  school_name TEXT,
  school_type TEXT,
  region TEXT,
  address TEXT,
  grade INTEGER,
  class_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기존 데이터 마이그레이션 (users 테이블의 school_info_id를 사용하여 매핑)
INSERT INTO school_infos_new (
  user_id,
  school_code,
  school_name,
  school_type,
  region,
  address,
  grade,
  class_number,
  created_at,
  updated_at
)
SELECT 
  u.id as user_id,
  si.school_code,
  si.school_name,
  si.school_type,
  si.region,
  si.address,
  si.grade,
  si.class_number,
  si.created_at,
  si.updated_at
FROM school_infos si
JOIN users u ON u.school_info_id = si.id;

-- 원래 테이블 삭제하고 새 테이블로 교체
DROP TABLE IF EXISTS school_infos CASCADE;
ALTER TABLE school_infos_new RENAME TO school_infos;

-- users 테이블에서 school_info_id 컬럼 제거
ALTER TABLE users
DROP COLUMN IF EXISTS school_info_id;
