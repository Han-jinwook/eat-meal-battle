-- family_groups 테이블에 대한 조회(SELECT) 권한을 클라이언트(anon, authenticated)에 허용하는 SQL 스크립트
-- 실행 방법: Supabase Dashboard -> SQL Editor에 복사하여 실행하세요.

ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for all" ON public.family_groups;

CREATE POLICY "Allow select for all" ON public.family_groups 
FOR SELECT TO anon, authenticated 
USING (true);
