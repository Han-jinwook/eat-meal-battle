-- meal_reservations 테이블 생성 스크립트

CREATE TABLE IF NOT EXISTS public.meal_reservations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    date date NOT NULL,
    time text,
    meal_type text NOT NULL,
    menu text NOT NULL,
    place text,
    memo text,
    thumbnail text,
    source_url text,
    source text DEFAULT 'solo',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.meal_reservations ENABLE ROW LEVEL SECURITY;

-- 기존 정책 제거 후 WhatEat 공통 보안 정책 적용 (SELECT 전용 허용, 쓰기는 /api/db/write에서 처리)
DROP POLICY IF EXISTS "Users can view their own reservations" ON public.meal_reservations;
DROP POLICY IF EXISTS "Users can insert their own reservations" ON public.meal_reservations;
DROP POLICY IF EXISTS "Users can update their own reservations" ON public.meal_reservations;
DROP POLICY IF EXISTS "Users can delete their own reservations" ON public.meal_reservations;
DROP POLICY IF EXISTS "Allow select for all" ON public.meal_reservations;

CREATE POLICY "Allow select for all" ON public.meal_reservations FOR SELECT TO anon, authenticated USING (true);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_meal_reservations_user_id ON public.meal_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_reservations_date ON public.meal_reservations(date);
