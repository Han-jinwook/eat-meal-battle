-- meal_likes (맛톡 식사 좋아요) 테이블 생성 및 RLS 정책 수립
CREATE TABLE IF NOT EXISTS public.meal_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  meal_id uuid,
  user_id uuid,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT meal_likes_pkey PRIMARY KEY (id),
  CONSTRAINT meal_likes_meal_id_fkey FOREIGN KEY (meal_id) REFERENCES public.meal_images(id) ON DELETE CASCADE,
  CONSTRAINT meal_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT meal_likes_user_meal_unique UNIQUE (user_id, meal_id)
);

-- RLS 활성화 및 인증된 사용자 권한 정책 부여
ALTER TABLE public.meal_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.meal_likes;
CREATE POLICY "Allow all for authenticated users" ON public.meal_likes FOR ALL TO authenticated USING (true) WITH CHECK (true);
