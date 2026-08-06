-- meal_reservations 테이블의 date 컬럼에 대한 NOT NULL 제약조건 제거
-- 가족 위시리스트 아이템(date가 없음) 저장을 허용하기 위해 nullable로 변경합니다.

ALTER TABLE public.meal_reservations ALTER COLUMN date DROP NOT NULL;
