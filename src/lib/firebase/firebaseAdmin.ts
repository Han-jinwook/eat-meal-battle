import * as admin from 'firebase-admin';

// Firebase Admin SDK 초기화
if (!admin.apps.length) {
  // 로컬 개발 환경과 배포 환경에서의 초기화 처리 분리
  if (process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    // 환경 변수에서 프라이빗 키를 가져옴 (배포 환경)
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        // 개행 문자 처리 (환경 변수에서는 \n이 문자열로 저장됨)
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      databaseURL: process.env.FIREBASE_ADMIN_DATABASE_URL,
    });
  } else {
    // 로컬 개발 환경에서는 서비스 계정 키 파일 사용
    // 주의: 실제 서비스 계정 키 파일은 Git에 업로드하지 마세요!
    try {
      const serviceAccount = require('../../../firebase-service-account.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (error) {
      console.error('Firebase Admin 초기화 오류:', error);
      // 서비스 계정 키 파일이 없는 경우, 더미 초기화
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    }
  }
}

// Firebase Admin 인스턴스 내보내기
export default admin;
