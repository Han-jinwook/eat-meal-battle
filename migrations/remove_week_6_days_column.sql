-- Remove week_6 related columns from both tables
-- Monday-based ISO week calculation can only have max 5 weeks per month

-- 1. Remove week_6_days from champion_criteria table
ALTER TABLE champion_criteria DROP COLUMN IF EXISTS week_6_days;

-- 2. Remove week_6_correct from quiz_champions table  
ALTER TABLE quiz_champions DROP COLUMN IF EXISTS week_6_correct;

-- 3. Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'champion_criteria' 
  AND column_name LIKE 'week_%'
ORDER BY column_name;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'quiz_champions' 
  AND column_name LIKE 'week_%'
ORDER BY column_name;

-- Expected result: only week_1 through week_5 should remain
