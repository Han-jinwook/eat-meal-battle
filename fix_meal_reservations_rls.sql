-- Supabase Dashboard -> SQL Editor에서 실행해주세요.
-- meal_reservations 테이블의 RLS 정책을 WhatEat 표준(SELECT 전용 허용, 쓰기는 /api/db/write)으로 갱신하는 스크립트입니다.

DROP POLICY IF EXISTS "Users can view their own reservations" ON public.meal_reservations;
DROP POLICY IF EXISTS "Users can insert their own reservations" ON public.meal_reservations;
DROP POLICY IF EXISTS "Users can update their own reservations" ON public.meal_reservations;
DROP POLICY IF EXISTS "Users can delete their own reservations" ON public.meal_reservations;
DROP POLICY IF EXISTS "Allow select for all" ON public.meal_reservations;

CREATE POLICY "Allow select for all" ON public.meal_reservations FOR SELECT TO anon, authenticated USING (true);
