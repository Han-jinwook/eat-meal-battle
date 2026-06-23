-- 모든 테이블의 RLS 정책을 anon(비인증/익명) 및 authenticated(인증) 사용자 모두에게 허용하도록 수정하는 스크립트
-- 실행 방법: Supabase Dashboard -> SQL Editor에 복사하여 실행하세요.

DO $$
DECLARE
    row record;
BEGIN
    FOR row IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        -- 1. 기존의 authenticated 전용 정책 제거
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.%I;', row.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for all users" ON public.%I;', row.tablename);

        -- 2. 새로운 공용 정책 생성 (anon, authenticated 모두에게 모든 권한 허용)
        -- 프론트엔드가 Merlin Hub SDK 세션을 기반으로 동작하므로, Supabase 상에서는 anon(익명) 권한으로 요청이 들어오게 됩니다.
        -- 따라서 anon 권한에서도 데이터 읽기/쓰기가 가능해야 정상 작동합니다.
        EXECUTE format('CREATE POLICY "Allow all for all users" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);', row.tablename);
        
        RAISE NOTICE 'Table % RLS policy updated to allow anon and authenticated.', row.tablename;
    END LOOP;
END;
$$;
