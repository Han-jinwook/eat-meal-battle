-- 실시간(Supabase Realtime) DELETE 이벤트에서 이전 값을 온전히 수신하기 위해
-- meal_likes, comments, comment_replies 테이블의 REPLICA IDENTITY를 FULL로 설정합니다.
ALTER TABLE public.meal_likes REPLICA IDENTITY FULL;
ALTER TABLE public.comments REPLICA IDENTITY FULL;
ALTER TABLE public.comment_replies REPLICA IDENTITY FULL;
