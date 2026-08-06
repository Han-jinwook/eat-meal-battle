-- 가족/모임 실시간 동기화(Supabase Realtime) 완벽 연동 스크립트
-- 1. Realtime 게시(Publication)에 예약, 좋아요, 댓글 관련 테이블 모두 추가
-- 2. DELETE 이벤트 수신을 위해 REPLICA IDENTITY FULL 설정
-- 3. RLS 조회(SELECT) 권한 전체 허용 정책 확립

-- [1] Supabase Realtime 게시물(Publication) 추가
DO $$
BEGIN
  -- meal_reservations (예약/위시리스트) 추가
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'meal_reservations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_reservations;
  END IF;

  -- meal_likes (좋아요) 추가
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'meal_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_likes;
  END IF;

  -- comments (댓글) 추가
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
  END IF;

  -- comment_replies (대댓글) 추가
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'comment_replies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_replies;
  END IF;
END $$;


-- [2] 실시간 DELETE 이벤트 시 이전 정보(ID 등) 유실 방지를 위해 REPLICA IDENTITY를 FULL로 변경
ALTER TABLE public.meal_reservations REPLICA IDENTITY FULL;
ALTER TABLE public.meal_likes REPLICA IDENTITY FULL;
ALTER TABLE public.comments REPLICA IDENTITY FULL;
ALTER TABLE public.comment_replies REPLICA IDENTITY FULL;


-- [3] 실시간 수신 및 조회를 방해하는 RLS 조회 권한 정책 재정비 (SELECT 전체 허용)
-- meal_reservations
ALTER TABLE public.meal_reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for all" ON public.meal_reservations;
CREATE POLICY "Allow select for all" ON public.meal_reservations FOR SELECT TO anon, authenticated USING (true);

-- meal_likes
ALTER TABLE public.meal_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for all" ON public.meal_likes;
CREATE POLICY "Allow select for all" ON public.meal_likes FOR SELECT TO anon, authenticated USING (true);

-- comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for all" ON public.comments;
CREATE POLICY "Allow select for all" ON public.comments FOR SELECT TO anon, authenticated USING (true);

-- comment_replies
ALTER TABLE public.comment_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for all" ON public.comment_replies;
CREATE POLICY "Allow select for all" ON public.comment_replies FOR SELECT TO anon, authenticated USING (true);
