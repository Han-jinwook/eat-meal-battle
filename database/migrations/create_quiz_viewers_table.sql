-- 퀴즈 관람자 관계 테이블 생성
-- 학생(퀴즈 주인)과 부모(관람자) 간의 관계를 관리

CREATE TABLE IF NOT EXISTS quiz_viewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 중복 관계 방지를 위한 유니크 제약
  UNIQUE(quiz_owner_id, viewer_id)
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_quiz_viewers_owner ON quiz_viewers(quiz_owner_id);
CREATE INDEX IF NOT EXISTS idx_quiz_viewers_viewer ON quiz_viewers(viewer_id);
CREATE INDEX IF NOT EXISTS idx_quiz_viewers_created_at ON quiz_viewers(created_at);

-- RLS (Row Level Security) 정책 활성화
ALTER TABLE quiz_viewers ENABLE ROW LEVEL SECURITY;

-- 정책 1: 퀴즈 주인은 자신의 관람자 목록을 조회할 수 있음
CREATE POLICY "quiz_owners_can_view_their_viewers" ON quiz_viewers
  FOR SELECT
  USING (quiz_owner_id = auth.uid());

-- 정책 2: 관람자는 자신이 관람하는 퀴즈 목록을 조회할 수 있음
CREATE POLICY "viewers_can_view_their_watching_quizzes" ON quiz_viewers
  FOR SELECT
  USING (viewer_id = auth.uid());

-- 정책 3: 새로운 관람자 관계 생성 (초대 링크를 통해서만)
CREATE POLICY "allow_viewer_registration" ON quiz_viewers
  FOR INSERT
  WITH CHECK (viewer_id = auth.uid());

-- 정책 4: 퀴즈 주인은 관람자를 삭제할 수 있음
CREATE POLICY "quiz_owners_can_remove_viewers" ON quiz_viewers
  FOR DELETE
  USING (quiz_owner_id = auth.uid());

-- 정책 5: 관람자는 자신의 관람 관계를 삭제할 수 있음 (구독 취소)
CREATE POLICY "viewers_can_unsubscribe" ON quiz_viewers
  FOR DELETE
  USING (viewer_id = auth.uid());

-- 트리거 함수: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_quiz_viewers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER quiz_viewers_updated_at_trigger
  BEFORE UPDATE ON quiz_viewers
  FOR EACH ROW
  EXECUTE FUNCTION update_quiz_viewers_updated_at();

-- 코멘트 추가
COMMENT ON TABLE quiz_viewers IS '퀴즈 관람자 관계 테이블 - 학생과 부모 간의 퀴즈 공유 관계를 관리';
COMMENT ON COLUMN quiz_viewers.quiz_owner_id IS '퀴즈 주인(학생)의 사용자 ID';
COMMENT ON COLUMN quiz_viewers.viewer_id IS '관람자(부모)의 사용자 ID';
COMMENT ON COLUMN quiz_viewers.created_at IS '관계 생성 시간';
COMMENT ON COLUMN quiz_viewers.updated_at IS '관계 수정 시간';
