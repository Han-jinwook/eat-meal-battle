-- meal_menus 테이블 생성
CREATE TABLE IF NOT EXISTS meal_menus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_code TEXT NOT NULL,
  office_code TEXT NOT NULL,
  meal_date TEXT NOT NULL, -- YYYYMMDD 형식
  meal_type TEXT NOT NULL, -- 조식, 중식, 석식
  menu_items JSONB, -- 메뉴 항목 배열
  kcal TEXT, -- 칼로리 정보
  nutrition_info JSONB, -- 영양소 정보 (단백질, 탄수화물 등)
  origin_info TEXT, -- 원산지 정보
  ntr_info TEXT, -- 기타 영양 정보
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS meal_menus_school_code_idx ON meal_menus (school_code);
CREATE INDEX IF NOT EXISTS meal_menus_date_idx ON meal_menus (meal_date);
CREATE UNIQUE INDEX IF NOT EXISTS meal_menus_unique_idx ON meal_menus (school_code, office_code, meal_date, meal_type);

-- RLS 정책 설정
ALTER TABLE meal_menus ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽을 수 있도록 정책 설정
CREATE POLICY "급식 정보는 모든 사용자가 볼 수 있음" ON meal_menus
  FOR SELECT USING (true);

-- 사용자 저장함수 설정 - 업데이트 시간 자동 갱신
CREATE OR REPLACE FUNCTION update_meal_menus_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 설정
CREATE TRIGGER update_meal_menus_updated_at
BEFORE UPDATE ON meal_menus
FOR EACH ROW
EXECUTE PROCEDURE update_meal_menus_updated_at();
