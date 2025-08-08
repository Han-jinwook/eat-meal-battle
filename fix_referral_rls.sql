-- 소개자 시스템 RLS 정책 수정
-- 실행 방법: Supabase SQL Editor에서 실행

-- 1. referrals 테이블 RLS 정책
DROP POLICY IF EXISTS "Users can insert their own referral relationships" ON referrals;
DROP POLICY IF EXISTS "Users can view referral relationships" ON referrals;

CREATE POLICY "Users can insert referral relationships" ON referrals
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view referral relationships" ON referrals
  FOR SELECT USING (
    referrer_id = auth.uid() OR 
    referee_id = auth.uid()
  );

-- 2. referral_stats 테이블 RLS 정책  
DROP POLICY IF EXISTS "Users can manage referral stats" ON referral_stats;

CREATE POLICY "Users can insert referral stats" ON referral_stats
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update referral stats" ON referral_stats
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can view referral stats" ON referral_stats
  FOR SELECT USING (user_id = auth.uid());

-- 3. users 테이블에 referral_code 컬럼 추가 (없는 경우)
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;

-- 4. users 테이블 RLS 정책 (referral_code 조회용)
DROP POLICY IF EXISTS "Users can view referral codes" ON users;

CREATE POLICY "Users can view referral codes for referrals" ON users
  FOR SELECT USING (true);

-- 5. users 테이블 UPDATE 정책 (referral_code 설정용)
DROP POLICY IF EXISTS "Users can update own referral code" ON users;

CREATE POLICY "Users can update own referral code" ON users
  FOR UPDATE USING (id = auth.uid());
