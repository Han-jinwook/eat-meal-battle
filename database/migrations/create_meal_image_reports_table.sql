-- 급식 이미지 등록오류 신고 테이블 생성
CREATE TABLE IF NOT EXISTS meal_image_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  image_id UUID NOT NULL REFERENCES meal_images(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_code TEXT NOT NULL,
  meal_date DATE NOT NULL,
  meal_type TEXT NOT NULL,
  image_url TEXT NOT NULL,
  uploader_nickname TEXT,
  report_reason TEXT DEFAULT '등록오류',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES users(id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_meal_image_reports_status ON meal_image_reports(status);
CREATE INDEX IF NOT EXISTS idx_meal_image_reports_created_at ON meal_image_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_image_reports_school_date ON meal_image_reports(school_code, meal_date);
CREATE INDEX IF NOT EXISTS idx_meal_image_reports_reporter ON meal_image_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_meal_image_reports_image ON meal_image_reports(image_id);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE meal_image_reports ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신이 신고한 내용만 조회 가능
CREATE POLICY "Users can view their own reports" ON meal_image_reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- 사용자는 신고 생성 가능
CREATE POLICY "Users can create reports" ON meal_image_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- 관리자 정책은 추후 관리자 권한 시스템 구현 시 추가
-- 현재는 사용자 본인 신고만 조회/생성 가능

-- 테이블에 대한 코멘트 추가
COMMENT ON TABLE meal_image_reports IS '급식 이미지 등록오류 신고 테이블';
COMMENT ON COLUMN meal_image_reports.id IS '신고 고유 ID';
COMMENT ON COLUMN meal_image_reports.image_id IS '신고된 이미지 ID';
COMMENT ON COLUMN meal_image_reports.reporter_id IS '신고자 사용자 ID';
COMMENT ON COLUMN meal_image_reports.school_code IS '학교 코드';
COMMENT ON COLUMN meal_image_reports.meal_date IS '급식 날짜';
COMMENT ON COLUMN meal_image_reports.meal_type IS '급식 유형 (중식 등)';
COMMENT ON COLUMN meal_image_reports.image_url IS '신고된 이미지 URL';
COMMENT ON COLUMN meal_image_reports.uploader_nickname IS '이미지 업로더 닉네임';
COMMENT ON COLUMN meal_image_reports.report_reason IS '신고 사유';
COMMENT ON COLUMN meal_image_reports.status IS '처리 상태 (pending, reviewed, resolved, dismissed)';
COMMENT ON COLUMN meal_image_reports.admin_notes IS '관리자 메모';
COMMENT ON COLUMN meal_image_reports.created_at IS '신고 생성 시간';
COMMENT ON COLUMN meal_image_reports.reviewed_at IS '검토 완료 시간';
COMMENT ON COLUMN meal_image_reports.reviewed_by IS '검토한 관리자 ID';
