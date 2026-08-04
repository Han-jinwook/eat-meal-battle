-- update_school_rating_stats 트리거 함수 수정
-- 솔로/패밀리/맛톡 등 일반 개인 식사는 학교 급식이 아니므로 school_code가 존재하지 않습니다(NULL).
-- school_code가 NULL인 경우 평점 통계 테이블(meal_rating_stats) 갱신을 건너뛰고 즉시 종료하도록 예외 처리를 추가합니다.

CREATE OR REPLACE FUNCTION public.update_school_rating_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_meal_id UUID;
  v_school_code TEXT;
  v_user_id UUID;
  v_rating_sum NUMERIC;
  v_rating_count INT;
  v_grade1_sum NUMERIC := 0;
  v_grade1_count INT := 0;
  v_grade2_sum NUMERIC := 0;
  v_grade2_count INT := 0;
  v_grade3_sum NUMERIC := 0;
  v_grade3_count INT := 0;
  v_grade4_sum NUMERIC := 0;
  v_grade4_count INT := 0;
  v_grade5_sum NUMERIC := 0;
  v_grade5_count INT := 0;
  v_grade6_sum NUMERIC := 0;
  v_grade6_count INT := 0;
BEGIN
  -- 새 평가가 추가되거나 기존 평가가 업데이트 된 경우
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE') THEN
    v_meal_id := NEW.meal_id;
    v_user_id := NEW.user_id;
  -- 평가가 삭제된 경우
  ELSIF (TG_OP = 'DELETE') THEN
    v_meal_id := OLD.meal_id;
    v_user_id := OLD.user_id;
  END IF;
  
  -- meal_menus 테이블에서 school_code 가져오기
  SELECT school_code INTO v_school_code 
  FROM meal_menus 
  WHERE id = v_meal_id;

  -- school_code가 없거나 NULL인 경우 (솔로/가족방/맛톡 등 일반 식사) 통계 집계 자체를 수행하지 않고 종료
  IF v_school_code IS NULL THEN
    RETURN NULL;
  END IF;

  -- 학교 전체 통계 계산
  SELECT
    COALESCE(SUM(r.rating), 0),
    COUNT(*)
  INTO
    v_rating_sum,
    v_rating_count
  FROM
    meal_ratings r
  WHERE
    r.meal_id = v_meal_id;

  -- 학년별 통계 계산 (1학년)
  SELECT
    COALESCE(SUM(r.rating), 0),
    COUNT(*)
  INTO
    v_grade1_sum,
    v_grade1_count
  FROM
    meal_ratings r
  JOIN school_infos si ON r.user_id = si.user_id
  WHERE
    r.meal_id = v_meal_id
    AND si.grade = 1;

  -- 학년별 통계 계산 (2학년)
  SELECT
    COALESCE(SUM(r.rating), 0),
    COUNT(*)
  INTO
    v_grade2_sum,
    v_grade2_count
  FROM
    meal_ratings r
  JOIN school_infos si ON r.user_id = si.user_id
  WHERE
    r.meal_id = v_meal_id
    AND si.grade = 2;

  -- 학년별 통계 계산 (3학년)
  SELECT
    COALESCE(SUM(r.rating), 0),
    COUNT(*)
  INTO
    v_grade3_sum,
    v_grade3_count
  FROM
    meal_ratings r
  JOIN school_infos si ON r.user_id = si.user_id
  WHERE
    r.meal_id = v_meal_id
    AND si.grade = 3;

  -- 학년별 통계 계산 (4학년)
  SELECT
    COALESCE(SUM(r.rating), 0),
    COUNT(*)
  INTO
    v_grade4_sum,
    v_grade4_count
  FROM
    meal_ratings r
  JOIN school_infos si ON r.user_id = si.user_id
  WHERE
    r.meal_id = v_meal_id
    AND si.grade = 4;

  -- 학년별 통계 계산 (5학년)
  SELECT
    COALESCE(SUM(r.rating), 0),
    COUNT(*)
  INTO
    v_grade5_sum,
    v_grade5_count
  FROM
    meal_ratings r
  JOIN school_infos si ON r.user_id = si.user_id
  WHERE
    r.meal_id = v_meal_id
    AND si.grade = 5;

  -- 학년별 통계 계산 (6학년)
  SELECT
    COALESCE(SUM(r.rating), 0),
    COUNT(*)
  INTO
    v_grade6_sum,
    v_grade6_count
  FROM
    meal_ratings r
  JOIN school_infos si ON r.user_id = si.user_id
  WHERE
    r.meal_id = v_meal_id
    AND si.grade = 6;

  -- 통계 테이블 업데이트 또는 삽입
  INSERT INTO meal_rating_stats
    (meal_id, school_code, avg_rating, rating_count, 
     grade1_avg, grade1_count, grade2_avg, grade2_count, 
     grade3_avg, grade3_count, grade4_avg, grade4_count, 
     grade5_avg, grade5_count, grade6_avg, grade6_count, 
     updated_at)
  VALUES
    (v_meal_id, v_school_code, 
     ROUND(CASE WHEN v_rating_count > 0 THEN v_rating_sum / v_rating_count ELSE 0 END, 1),
     v_rating_count, 
     ROUND(CASE WHEN v_grade1_count > 0 THEN v_grade1_sum / v_grade1_count ELSE 0 END, 1),
     v_grade1_count,
     ROUND(CASE WHEN v_grade2_count > 0 THEN v_grade2_sum / v_grade2_count ELSE 0 END, 1),
     v_grade2_count,
     ROUND(CASE WHEN v_grade3_count > 0 THEN v_grade3_sum / v_grade3_count ELSE 0 END, 1),
     v_grade3_count,
     ROUND(CASE WHEN v_grade4_count > 0 THEN v_grade4_sum / v_grade4_count ELSE 0 END, 1),
     v_grade4_count,
     ROUND(CASE WHEN v_grade5_count > 0 THEN v_grade5_sum / v_grade5_count ELSE 0 END, 1),
     v_grade5_count,
     ROUND(CASE WHEN v_grade6_count > 0 THEN v_grade6_sum / v_grade6_count ELSE 0 END, 1),
     v_grade6_count,
     now())
  ON CONFLICT (meal_id, school_code)
  DO UPDATE SET
    avg_rating = ROUND(CASE WHEN v_rating_count > 0 THEN v_rating_sum / v_rating_count ELSE 0 END, 1),
    rating_count = v_rating_count,
    grade1_avg = ROUND(CASE WHEN v_grade1_count > 0 THEN v_grade1_sum / v_grade1_count ELSE 0 END, 1),
    grade1_count = v_grade1_count,
    grade2_avg = ROUND(CASE WHEN v_grade2_count > 0 THEN v_grade2_sum / v_grade2_count ELSE 0 END, 1),
    grade2_count = v_grade2_count,
    grade3_avg = ROUND(CASE WHEN v_grade3_count > 0 THEN v_grade3_sum / v_grade3_count ELSE 0 END, 1),
    grade3_count = v_grade3_count,
    grade4_avg = ROUND(CASE WHEN v_grade4_count > 0 THEN v_grade4_sum / v_grade4_count ELSE 0 END, 1),
    grade4_count = v_grade4_count,
    grade5_avg = ROUND(CASE WHEN v_grade5_count > 0 THEN v_grade5_sum / v_grade5_count ELSE 0 END, 1),
    grade5_count = v_grade5_count,
    grade6_avg = ROUND(CASE WHEN v_grade6_count > 0 THEN v_grade6_sum / v_grade6_count ELSE 0 END, 1),
    grade6_count = v_grade6_count,
    updated_at = now();

  RETURN NULL;
END;
$function$;
