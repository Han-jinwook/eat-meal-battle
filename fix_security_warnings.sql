-- Supabase Security Advisor 경고를 해결하기 위한 SQL 스크립트
-- 실행 방법: Supabase Dashboard -> SQL Editor에 붙여넣고 실행해 주세요.

--------------------------------------------------------------------------------
-- 1. SECURITY DEFINER 함수 권한 제한 (경고 코드: 0029)
-- 일반 anon/authenticated 사용자가 rpc 호출을 통해 직접 통계 함수를 실행하지 못하도록 
-- EXECUTE 권한을 박탈하고, DB 트리거 및 admin(postgres) 권한으로만 실행할 수 있도록 격리합니다.
--------------------------------------------------------------------------------

-- get_menu_item_rating_stats 함수 권한 제한
REVOKE EXECUTE ON FUNCTION public.get_menu_item_rating_stats(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_menu_item_rating_stats(uuid) TO postgres, service_role;

-- update_menu_item_rating_stats 함수 권한 제한
REVOKE EXECUTE ON FUNCTION public.update_menu_item_rating_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_menu_item_rating_stats() TO postgres, service_role;

-- update_school_rating_stats 함수 권한 제한
REVOKE EXECUTE ON FUNCTION public.update_school_rating_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_school_rating_stats() TO postgres, service_role;


--------------------------------------------------------------------------------
-- 2. GraphQL 스키마 노출 해결 (경고 코드: 0026, 0027)
-- 앱 서비스가 REST API(Supabase Client SDK)만 사용하고 GraphQL을 전혀 사용하지 않는 경우,
-- 아래 명령어를 통해 pg_graphql 확장 기능을 비활성화하면 관련 경고가 모두 즉시 사라집니다.
-- (만약 나중에 GraphQL을 사용해야 한다면 주석을 해제하지 말고 경고만 무시하시거나, 
--  테이블 권한을 추가 조정해야 합니다.)
--------------------------------------------------------------------------------

-- DROP EXTENSION IF EXISTS pg_graphql CASCADE;
