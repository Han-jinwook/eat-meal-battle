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

-- 조회 정책: 본인이 작성한 예약만 조회 가능
CREATE POLICY "Users can view their own reservations"
    ON public.meal_reservations FOR SELECT
    USING (auth.uid() = user_id);

-- 삽입 정책: 본인의 예약만 생성 가능
CREATE POLICY "Users can insert their own reservations"
    ON public.meal_reservations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 수정 정책: 본인이 작성한 예약만 수정 가능
CREATE POLICY "Users can update their own reservations"
    ON public.meal_reservations FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 삭제 정책: 본인이 작성한 예약만 삭제 가능
CREATE POLICY "Users can delete their own reservations"
    ON public.meal_reservations FOR DELETE
    USING (auth.uid() = user_id);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_meal_reservations_user_id ON public.meal_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_reservations_date ON public.meal_reservations(date);
