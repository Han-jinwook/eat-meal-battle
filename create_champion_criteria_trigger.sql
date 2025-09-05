-- 새 학교 등록 시 champion_criteria 자동 생성 트리거 함수
-- 자동 스케줄러와 동일한 토요일 계산 로직 사용

-- 1. 주차별 토요일 계산 함수 (자동 스케줄러와 동일한 로직)
CREATE OR REPLACE FUNCTION calculate_weekly_saturdays(target_year INTEGER, target_month INTEGER)
RETURNS TABLE(
    week_1_saturday DATE,
    week_2_saturday DATE, 
    week_3_saturday DATE,
    week_4_saturday DATE,
    week_5_saturday DATE
) AS $$
DECLARE
    first_day_of_month DATE;
    day_of_week INTEGER;
    days_to_monday INTEGER;
    first_monday DATE;
    saturday_date DATE;
BEGIN
    -- 해당 월의 1일
    first_day_of_month := make_date(target_year, target_month, 1);
    
    -- ISO 8601 첫 주의 월요일 찾기
    day_of_week := EXTRACT(DOW FROM first_day_of_month); -- 0: 일요일, 1: 월요일, ..., 6: 토요일
    days_to_monday := CASE WHEN day_of_week = 0 THEN 1 ELSE (8 - day_of_week) % 7 END;
    
    first_monday := first_day_of_month + days_to_monday;
    
    -- 첫 주 토요일 계산 (월요일 + 5일)
    saturday_date := first_monday + 5;
    
    -- 각 주차별 토요일 반환 (최대 5주차까지)
    week_1_saturday := saturday_date;
    week_2_saturday := saturday_date + 7;
    week_3_saturday := saturday_date + 14;
    week_4_saturday := saturday_date + 21;
    week_5_saturday := saturday_date + 28;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- 2. 트리거 함수 생성 (새 학교 등록 시 champion_criteria 자동 생성)
CREATE OR REPLACE FUNCTION create_champion_criteria_for_new_school()
RETURNS TRIGGER 
SECURITY DEFINER -- RLS 정책 우회
AS $$
DECLARE
    current_year INTEGER;
    current_month INTEGER;
    next_year INTEGER;
    next_month INTEGER;
    current_sats RECORD;
    next_sats RECORD;
BEGIN
    -- 현재 년/월 계산
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    current_month := EXTRACT(MONTH FROM CURRENT_DATE);
    
    -- 다음 월 계산
    IF current_month = 12 THEN
        next_year := current_year + 1;
        next_month := 1;
    ELSE
        next_year := current_year;
        next_month := current_month + 1;
    END IF;
    
    -- 주차별 토요일 날짜 계산 (자동 스케줄러와 동일한 로직)
    SELECT * INTO current_sats FROM calculate_weekly_saturdays(current_year, current_month);
    SELECT * INTO next_sats FROM calculate_weekly_saturdays(next_year, next_month);
    
    -- 현재 월 champion_criteria 생성 (토요일 날짜 포함)
    INSERT INTO champion_criteria (
        school_code, year, month,
        week_1_saturday, week_2_saturday, week_3_saturday, week_4_saturday, week_5_saturday,
        created_at
    )
    VALUES (
        NEW.school_code, current_year, current_month,
        current_sats.week_1_saturday, current_sats.week_2_saturday, 
        current_sats.week_3_saturday, current_sats.week_4_saturday, current_sats.week_5_saturday,
        NOW()
    )
    ON CONFLICT (school_code, year, month) DO NOTHING;
    
    -- 다음 월 champion_criteria 생성 (토요일 날짜 포함)
    INSERT INTO champion_criteria (
        school_code, year, month,
        week_1_saturday, week_2_saturday, week_3_saturday, week_4_saturday, week_5_saturday,
        created_at
    )
    VALUES (
        NEW.school_code, next_year, next_month,
        next_sats.week_1_saturday, next_sats.week_2_saturday,
        next_sats.week_3_saturday, next_sats.week_4_saturday, next_sats.week_5_saturday,
        NOW()
    )
    ON CONFLICT (school_code, year, month) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. 트리거 생성 (school_infos 테이블에 새 학교 등록 시 실행)
DROP TRIGGER IF EXISTS trigger_create_champion_criteria ON school_infos;
CREATE TRIGGER trigger_create_champion_criteria
    AFTER INSERT ON school_infos
    FOR EACH ROW
    EXECUTE FUNCTION create_champion_criteria_for_new_school();
