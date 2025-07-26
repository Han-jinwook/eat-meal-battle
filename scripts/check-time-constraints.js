#!/usr/bin/env node

/**
 * 급식 시스템 시간 제약 상태 확인 스크립트
 * 
 * 사용법: node scripts/check-time-constraints.js
 * 
 * 기능:
 * - MealCard.tsx의 canRateAtCurrentTime 함수 상태 확인
 * - MealImageUploader.tsx의 checkIfAiImageNeeded 함수 상태 확인
 * 
 * 출력:
 * - 테스트 모드: 시간 제약 해제 상태
 * - 프로덕션 모드: 시간 제약 활성화 상태
 * 
 * 모드 전환: node scripts/toggle-time-constraints.js [test|prod]
 */

const fs = require('fs');
const path = require('path');

// 파일 경로 정의
const mealCardPath = path.join(__dirname, '../apps/app/src/components/MealCard.tsx');
const mealImageUploaderPath = path.join(__dirname, '../apps/app/src/components/MealImageUploader.tsx');

/**
 * 현재 모드 확인
 */
function checkCurrentMode() {
  try {
    const mealCardContent = fs.readFileSync(mealCardPath, 'utf8');
    const uploaderContent = fs.readFileSync(mealImageUploaderPath, 'utf8');
    
    // MealCard 테스트 모드 확인
    const mealCardTestMode = mealCardContent.includes('return true;') && 
                            !mealCardContent.includes('// return true;');
    
    // MealImageUploader 테스트 모드 확인
    const uploaderTestMode = uploaderContent.includes('const isPastCutoffTime = true;') ||
                            uploaderContent.includes('isPastAiCutoffTime = true;');
    
    console.log('🔍 급식 시스템 시간 제약 현재 상태\n');
    console.log('📊 현재 모드 상태:');
    console.log(`   별점 시간 제약: ${mealCardTestMode ? '🟡 테스트 모드 (시간 제약 해제)' : '🟢 프로덕션 모드 (12시 이후)'}`);
    console.log(`   이미지 업로드: ${uploaderTestMode ? '🟡 테스트 모드 (시간 제약 해제)' : '🟢 프로덕션 모드 (12시/12:30 이후)'}`);
    
    if (mealCardTestMode || uploaderTestMode) {
      console.log('\n⚠️  경고: 일부 기능이 테스트 모드입니다!');
      console.log('   배포 전에 반드시 프로덕션 모드로 전환하세요.');
      console.log('   명령어: node scripts/toggle-time-constraints.js prod');
    } else {
      console.log('\n✅ 모든 기능이 프로덕션 모드입니다. 배포 준비 완료!');
    }
    
    console.log('\n📝 모드 전환 명령어:');
    console.log('   테스트 모드: node scripts/toggle-time-constraints.js test');
    console.log('   프로덕션 모드: node scripts/toggle-time-constraints.js prod');
    console.log('');
    
  } catch (error) {
    console.error('❌ 현재 모드 확인 실패:', error.message);
  }
}

checkCurrentMode();
