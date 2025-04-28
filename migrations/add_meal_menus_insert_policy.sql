-- meal_menus 테이블에 INSERT 정책 추가
CREATE POLICY "급식 정보 추가 정책" ON meal_menus
  FOR INSERT WITH CHECK (true);

-- is_empty_result 컬럼 추가 (빈 결과 플래그)
ALTER TABLE meal_menus ADD COLUMN IF NOT EXISTS is_empty_result BOOLEAN DEFAULT false;
