-- Add region_rank column to menu_battle_daily table
ALTER TABLE public.menu_battle_daily 
ADD COLUMN region_rank integer null;

-- Add region_rank column to menu_battle_monthly table  
ALTER TABLE public.menu_battle_monthly
ADD COLUMN region_rank integer null;

-- Create indexes for better performance on region_rank
CREATE INDEX IF NOT EXISTS idx_menu_battle_daily_region_rank 
ON public.menu_battle_daily USING btree (region_rank) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_menu_battle_monthly_region_rank 
ON public.menu_battle_monthly USING btree (region_rank) TABLESPACE pg_default;

-- Create composite indexes for efficient region-based queries
CREATE INDEX IF NOT EXISTS idx_menu_battle_daily_date_region_rank 
ON public.menu_battle_daily USING btree (battle_date, region_rank) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_menu_battle_monthly_year_month_region_rank 
ON public.menu_battle_monthly USING btree (battle_year, battle_month, region_rank) TABLESPACE pg_default;
