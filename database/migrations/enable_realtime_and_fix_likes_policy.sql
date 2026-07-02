-- 1. meal_likes 테이블에 대해 anon, authenticated 모두 SELECT(조회)할 수 있도록 RLS 정책 수정
ALTER TABLE public.meal_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.meal_likes;
DROP POLICY IF EXISTS "Allow select for all" ON public.meal_likes;
CREATE POLICY "Allow select for all" ON public.meal_likes FOR SELECT TO anon, authenticated USING (true);

-- 2. Supabase Realtime 게시(Publication)에 meal_likes, comments, comment_replies 테이블 안전하게 추가
DO $$
BEGIN
  -- meal_likes 추가
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'meal_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_likes;
  END IF;

  -- comments 추가
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
  END IF;

  -- comment_replies 추가
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'comment_replies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_replies;
  END IF;
END $$;
