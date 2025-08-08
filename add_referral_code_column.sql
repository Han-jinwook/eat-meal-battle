-- users 테이블에 referral_code 컬럼 추가
-- Supabase SQL Editor에서 실행

-- 1. referral_code 컬럼 추가
ALTER TABLE users 
ADD COLUMN referral_code VARCHAR(20) UNIQUE;

-- 2. 기존 사용자들에게 referral_code 생성
UPDATE users 
SET referral_code = CONCAT(
  LOWER(SUBSTRING(email FROM 1 FOR 4)),
  SUBSTRING(REPLACE(id::text, '-', '') FROM LENGTH(REPLACE(id::text, '-', '')) - 3)
)
WHERE referral_code IS NULL AND email IS NOT NULL;

-- 3. referral_code 컬럼에 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- 4. RLS 정책 추가 (referral_code 조회용)
CREATE POLICY IF NOT EXISTS "Users can view referral codes for referrals" ON users
  FOR SELECT USING (true);

-- 5. users 테이블 UPDATE 정책 (referral_code 설정용)  
CREATE POLICY IF NOT EXISTS "Users can update own referral code" ON users
  FOR UPDATE USING (id = auth.uid());

-- 6. referrals 테이블 RLS 정책
CREATE POLICY IF NOT EXISTS "Users can insert referral relationships" ON referrals
  FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Users can view referral relationships" ON referrals
  FOR SELECT USING (
    referrer_id = auth.uid() OR 
    referee_id = auth.uid()
  );

-- 7. referral_stats 테이블 RLS 정책
CREATE POLICY IF NOT EXISTS "Users can insert referral stats" ON referral_stats
  FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Users can update referral stats" ON referral_stats
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can view referral stats" ON referral_stats
  FOR SELECT USING (user_id = auth.uid());
