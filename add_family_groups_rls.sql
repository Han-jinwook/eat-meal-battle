-- 1. family_groups 테이블에 대한 조회(SELECT) 권한을 클라이언트(anon, authenticated)에 허용
ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for all" ON public.family_groups;
CREATE POLICY "Allow select for all" ON public.family_groups FOR SELECT TO anon, authenticated USING (true);

-- 2. family_groups 테이블에 chef_id(셰프 임명 저장용) 칼럼 추가
ALTER TABLE public.family_groups ADD COLUMN IF NOT EXISTS chef_id uuid REFERENCES public.users(id);

-- 3. meal_reservations 테이블의 date(날짜) 칼럼을 NULL 허용으로 변경 (가족 위시리스트용)
ALTER TABLE public.meal_reservations ALTER COLUMN date DROP NOT NULL;
