// 서비스 워커 등록 해제 스크립트
(async function() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log('서비스 워커 등록 목록 확인:', registrations.length);
      
      for (const registration of registrations) {
        const result = await registration.unregister();
        console.log('서비스 워커 등록 해제:', result ? '성공' : '실패', registration.scope);
      }
      
      console.log('서비스 워커 등록 해제 완료');
      alert('서비스 워커 등록 해제 완료. 페이지를 새로고침하세요.');
      window.location.reload();
    } else {
      console.log('이 브라우저는 서비스 워커를 지원하지 않습니다.');
      alert('이 브라우저는 서비스 워커를 지원하지 않습니다.');
    }
  } catch (error) {
    console.error('서비스 워커 등록 해제 중 오류 발생:', error);
    alert('서비스 워커 등록 해제 중 오류 발생: ' + error.message);
  }
})();
