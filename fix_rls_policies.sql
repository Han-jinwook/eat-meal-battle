-- 데이터베이스 보안을 강화하고 RLS 우회를 차단하는 SQL 스크립트
-- 모든 쓰기/수정/삭제 작업은 서버 사이드 API(/api/db/write)로 이관되었으므로,
-- 클라이언트(anon, authenticated)에게는 SELECT(조회) 권한만 부여하고 INSERT/UPDATE/DELETE 권한은 원천 차단합니다.
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
        -- 1. RLS(행 레벨 보안) 강제 활성화
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', row.tablename);

        -- 2. 기존의 안전하지 않은 광범위 허용 정책들 제거
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.%I;', row.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for all users" ON public.%I;', row.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Allow select for all users" ON public.%I;', row.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Allow select for all" ON public.%I;', row.tablename);

        -- 3. 안전한 조회 전용 정책 생성 (SELECT만 anon 및 authenticated에 허용)
        -- 쓰기/수정/삭제 정책을 생성하지 않음으로써 클라이언트의 직접적인 DB 수정은 차단됩니다.
        -- 서비스 롤(Service Role Key)을 사용하는 서버 API는 RLS를 우회하므로 영향 없이 정상 작동합니다.
        EXECUTE format('CREATE POLICY "Allow select for all" ON public.%I FOR SELECT TO anon, authenticated USING (true);', row.tablename);
        
        RAISE NOTICE 'Table % RLS policy updated: SELECT only for anon and authenticated.', row.tablename;
    END LOOP;
END;
$$;
