-- 메뉴 배틀 테이블들의 스키마 확인
-- 기본키 구조와 제약조건 확인

-- menu_battle_daily 테이블 구조 확인
\d menu_battle_daily

-- menu_battle_monthly 테이블 구조 확인  
\d menu_battle_monthly

-- 기본키 제약조건 확인
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name IN ('menu_battle_daily', 'menu_battle_monthly')
    AND tc.constraint_type = 'PRIMARY KEY'
ORDER BY tc.table_name, kcu.ordinal_position;

-- 유니크 제약조건도 확인
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name IN ('menu_battle_daily', 'menu_battle_monthly')
    AND tc.constraint_type = 'UNIQUE'
ORDER BY tc.table_name, kcu.ordinal_position;
