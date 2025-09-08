/**
 * 배틀 계산 강제 실행 스크립트
 * 수정된 로직을 적용하기 위해 특정 날짜의 배틀 계산을 다시 실행
 */

const { createClient } = require('@supabase/supabase-js');
const { calculateDailyMenuBattle, calculateMonthlyMenuBattle } = require('./apps/app/netlify/functions/utils/battleCalculator');

// Supabase Admin 클라이언트 초기화
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function triggerBattleCalculation(targetDate) {
  console.log(`🔄 배틀 계산 강제 실행 시작: ${targetDate}`);
  
  try {
    // 일별 메뉴 배틀 계산 (모든 학교 데이터 처리)
    console.log('📊 일별 메뉴 배틀 계산 중...');
    const dailyResult = await calculateDailyMenuBattle(targetDate, null, supabaseAdmin);
    
    if (dailyResult.success) {
      console.log(`✅ 일별 메뉴 배틀 계산 완료: ${dailyResult.data?.length || 0}개 아이템`);
    } else {
      console.error('❌ 일별 메뉴 배틀 계산 실패:', dailyResult.error);
    }
    
    // 월별 메뉴 배틀 계산 (모든 학교 데이터 처리)
    const date = new Date(targetDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    console.log('📊 월별 메뉴 배틀 계산 중...');
    const monthlyResult = await calculateMonthlyMenuBattle(year, month, null, supabaseAdmin);
    
    if (monthlyResult.success) {
      console.log(`✅ 월별 메뉴 배틀 계산 완료: ${monthlyResult.data?.length || 0}개 아이템`);
    } else {
      console.error('❌ 월별 메뉴 배틀 계산 실패:', monthlyResult.error);
    }
    
    console.log('🎉 배틀 계산 강제 실행 완료!');
    
  } catch (error) {
    console.error('💥 배틀 계산 중 오류 발생:', error);
  }
}

// 실행
const targetDate = process.argv[2] || '2025-09-08'; // 오늘 날짜로 수정
console.log(`🎯 실행할 날짜: ${targetDate}`);
triggerBattleCalculation(targetDate);
