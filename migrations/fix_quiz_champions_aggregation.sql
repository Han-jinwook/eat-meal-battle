-- quiz_champions 테이블 데이터 재집계
-- 기존 데이터 삭제 후 quiz_results 기반으로 재생성

-- 1. 기존 quiz_champions 데이터 삭제
DELETE FROM quiz_champions;

-- 2. quiz_results 기반으로 월별 집계 데이터 생성
INSERT INTO quiz_champions (user_id, year, month, correct_count, total_count, is_finalized)
SELECT 
    qr.user_id,
    EXTRACT(YEAR FROM mq.meal_date) as year,
    EXTRACT(MONTH FROM mq.meal_date) as month,
    SUM(CASE WHEN qr.is_correct THEN 1 ELSE 0 END) as correct_count,
    COUNT(*) as total_count,
    CASE 
        WHEN EXTRACT(YEAR FROM mq.meal_date) < EXTRACT(YEAR FROM CURRENT_DATE) 
             OR (EXTRACT(YEAR FROM mq.meal_date) = EXTRACT(YEAR FROM CURRENT_DATE) 
                 AND EXTRACT(MONTH FROM mq.meal_date) < EXTRACT(MONTH FROM CURRENT_DATE))
        THEN true 
        ELSE false 
    END as is_finalized
FROM quiz_results qr
JOIN meal_quizzes mq ON qr.quiz_id = mq.id
GROUP BY qr.user_id, EXTRACT(YEAR FROM mq.meal_date), EXTRACT(MONTH FROM mq.meal_date);

-- 3. 결과 확인
SELECT 
    user_id,
    year,
    month,
    correct_count,
    total_count,
    is_finalized
FROM quiz_champions 
ORDER BY year DESC, month DESC, user_id;
