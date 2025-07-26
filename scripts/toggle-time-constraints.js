#!/usr/bin/env node

/**
 * 급식 시스템 시간 제약 테스트/프로덕션 모드 전환 스크립트
 * 
 * 사용법:
 * node scripts/toggle-time-constraints.js test    # 테스트 모드 (시간 제약 해제)
 * node scripts/toggle-time-constraints.js prod    # 프로덕션 모드 (시간 제약 활성화)
 * 
 * 기능:
 * - 별점 시간 제약 (MealCard.tsx의 canRateAtCurrentTime 함수)
 * - 이미지 업로드 시간 제약 (MealImageUploader.tsx의 checkIfAiImageNeeded 함수)
 * 
 * 테스트 모드: 모든 시간 제약 해제 (언제든지 기능 사용 가능)
 * 프로덕션 모드: 시간 제약 활성화 (별점: 12시 이후, 이미지: 12시/12:30 이후)
 * 
 * ⚠️ 중요: 배포 전에 반드시 프로덕션 모드로 전환할 것!
 * 
 * 현재 상태 확인: node scripts/check-time-constraints.js
 */

const fs = require('fs');
const path = require('path');

const mode = process.argv[2];

if (!mode || !['test', 'prod'].includes(mode)) {
  console.error('❌ 사용법: node scripts/toggle-time-constraints.js [test|prod]');
  process.exit(1);
}

const isTestMode = mode === 'test';
const modeText = isTestMode ? '테스트 모드' : '프로덕션 모드';

console.log(`🔄 급식 시스템 시간 제약을 ${modeText}로 전환합니다...`);

// 파일 경로 정의
const mealCardPath = path.join(__dirname, '../apps/app/src/components/MealCard.tsx');
const mealImageUploaderPath = path.join(__dirname, '../apps/app/src/components/MealImageUploader.tsx');

/**
 * MealCard.tsx 파일 수정 (별점 시간 제약)
 */
function updateMealCard() {
  try {
    let content = fs.readFileSync(mealCardPath, 'utf8');
    
    if (isTestMode) {
      // 테스트 모드: return true 활성화
      content = content.replace(
        /\/\/ return true;.*?\n/g,
        'return true; // 테스트 모드: 시간 제약 해제\n'
      );
      content = content.replace(
        /const now = new Date\(\);/g,
        '// const now = new Date(); // 테스트 모드에서 주석 처리'
      );
    } else {
      // 프로덕션 모드: return true 주석 처리
      content = content.replace(
        /return true;.*?\n/g,
        '// return true; // 테스트 모드에서만 사용\n'
      );
      content = content.replace(
        /\/\/ const now = new Date\(\);.*?\n/g,
        'const now = new Date();\n'
      );
    }
    
    fs.writeFileSync(mealCardPath, content, 'utf8');
    console.log(`✅ MealCard.tsx 별점 시간 제약 ${modeText} 적용 완료`);
  } catch (error) {
    console.error(`❌ MealCard.tsx 수정 실패:`, error.message);
  }
}

/**
 * MealImageUploader.tsx 파일 수정 (이미지 업로드 시간 제약)
 */
function updateMealImageUploader() {
  try {
    let content = fs.readFileSync(mealImageUploaderPath, 'utf8');
    
    if (isTestMode) {
      // 테스트 모드: 날짜 및 시간 제약 해제
      
      // 날짜 제약 해제 (주석 처리)
      const dateConditionPattern = /if \(mealDate !== today\) \{[\s\S]*?return;\s*\}/;
      if (dateConditionPattern.test(content)) {
        content = content.replace(
          dateConditionPattern,
          '/*\n    if (mealDate !== today) {\n      console.log(\'\ubc84\ud2bc\ub4e4 \ube44\ud65c\uc131\ud654: \uc624\ub298 \ub0a0\uc9dc\uac00 \uc544\ub2d8\');\n      setShowAiGenButton(false);\n      setCanUploadImage(false);\n      return;\n    }\n    */'
        );
      }
      // 프로덕션 모드: 시간 제약 활성화
      content = content.replace(
        /const isPastCutoffTime = true;.*?\n/g,
        '// const isPastCutoffTime = true; // 테스트용: 항상 활성화\n'
      );
      content = content.replace(
        /\/\/ const isPastCutoffTime = hour >= 12;.*?\n/g,
        'const isPastCutoffTime = hour >= 12; // 프로덕션용: 12시 이후\n'
      );
      
      content = content.replace(
        /isPastAiCutoffTime = true;.*?\n/g,
        '// isPastAiCutoffTime = true; // 테스트용: 항상 활성화\n'
      );
      content = content.replace(
        /\/\/ isPastAiCutoffTime = hour > 12.*?\n/g,
        'isPastAiCutoffTime = hour > 12 || (hour === 12 && minute >= 30); // 프로덕션용: 12:30 이후\n'
      );
    }
    
    fs.writeFileSync(mealImageUploaderPath, content, 'utf8');
    console.log(`✅ MealImageUploader.tsx 이미지 업로드 시간 제약 ${modeText} 적용 완료`);
  } catch (error) {
    console.error(`❌ MealImageUploader.tsx 수정 실패:`, error.message);
  }
}

/**
 * 현재 모드 확인
 */
function checkCurrentMode() {
  try {
    const mealCardContent = fs.readFileSync(mealCardPath, 'utf8');
    const uploaderContent = fs.readFileSync(mealImageUploaderPath, 'utf8');
    
    const mealCardTestMode = mealCardContent.includes('return true; // 테스트 모드');
    const uploaderTestMode = uploaderContent.includes('const isPastCutoffTime = true; // 테스트용');
    
    console.log('\n📊 현재 모드 상태:');
    console.log(`   별점 시간 제약: ${mealCardTestMode ? '🟡 테스트 모드' : '🟢 프로덕션 모드'}`);
    console.log(`   이미지 업로드: ${uploaderTestMode ? '🟡 테스트 모드' : '🟢 프로덕션 모드'}`);
    
    if (mealCardTestMode || uploaderTestMode) {
      console.log('\n⚠️  경고: 일부 기능이 테스트 모드입니다. 배포 전에 프로덕션 모드로 전환하세요!');
    } else {
      console.log('\n✅ 모든 기능이 프로덕션 모드입니다.');
    }
  } catch (error) {
    console.error('❌ 현재 모드 확인 실패:', error.message);
  }
}

// 메인 실행
console.log(`\n🎯 ${modeText} 전환 시작...\n`);

updateMealCard();
updateMealImageUploader();

console.log(`\n🎉 ${modeText} 전환 완료!`);

checkCurrentMode();

if (isTestMode) {
  console.log('\n📝 테스트 모드 활성화됨:');
  console.log('   - 별점: 시간 제약 없이 언제든지 가능');
  console.log('   - 이미지 업로드: 시간 제약 없이 언제든지 가능');
  console.log('   - AI 이미지 생성: 시간 제약 없이 언제든지 가능');
  console.log('\n⚠️  배포 전에 반드시 프로덕션 모드로 전환하세요!');
  console.log('   명령어: node scripts/toggle-time-constraints.js prod');
} else {
  console.log('\n📝 프로덕션 모드 활성화됨:');
  console.log('   - 별점: 당일 12시 이후만 가능');
  console.log('   - 이미지 업로드: 당일 12시 이후만 가능');
  console.log('   - AI 이미지 생성: 당일 12:30 이후만 가능');
  console.log('\n✅ 배포 준비 완료!');
}

console.log('\n');
