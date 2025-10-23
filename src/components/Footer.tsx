import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer style={{ fontSize: '0.85rem', color: '#888', padding: '16px 0', textAlign: 'center', background: '#fafbfc', lineHeight: 1.7 }}>
      <div>
        <strong>법인명(상호)</strong> : 썬드림 주식회사 &nbsp;|
        <strong> 대표자(성명)</strong> : 백은숙 &nbsp;|
        <strong> 사업자 등록번호 안내</strong> : 333-87-00482 &nbsp;|
        <strong> 통신판매업 신고</strong> : 제 2023-인천부평-0929호
      </div>
      <div>
        <strong>주소</strong> : 21330 인천 부평구 주부토로 236 인천테크노밸리 U1센터 C동 1110호/1111호
      </div>
      <div>
        <strong>전화</strong> : 010-2597-7502 &nbsp;|
        <strong>개인정보관리책임자</strong> : 백은숙(beakes@naver.com)
      </div>
      <div style={{ marginTop: '8px' }}>
        <a href="/privacy-policy" style={{ color: '#666', textDecoration: 'underline' }}>
          개인정보처리방침
        </a>
      </div>
      
      {/* SEO 내부 링크 구조 */}
      <div style={{ marginTop: '12px', borderTop: '1px solid #eee', paddingTop: '12px' }}>
        <div style={{ fontSize: '0.8rem', color: '#999', marginBottom: '8px' }}>
          <strong>🍱 급식배틀 주요 서비스</strong>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px', fontSize: '0.75rem' }}>
          <a href="/quiz" style={{ color: '#666', textDecoration: 'none' }}>AI 급식퀴즈</a>
          <a href="/battle" style={{ color: '#666', textDecoration: 'none' }}>급식 랭킹</a>
          <a href="/about" style={{ color: '#666', textDecoration: 'none' }}>서비스 소개</a>
        </div>
        
        <div style={{ fontSize: '0.8rem', color: '#999', margin: '8px 0 4px' }}>
          <strong>🏫 인기 학교</strong>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', fontSize: '0.7rem' }}>
          <a href="/school/청라고등학교" style={{ color: '#666', textDecoration: 'none' }}>청라고등학교</a>
          <a href="/school/가림고등학교" style={{ color: '#666', textDecoration: 'none' }}>가림고등학교</a>
          <a href="/school/판교고등학교" style={{ color: '#666', textDecoration: 'none' }}>판교고등학교</a>
        </div>
        
        <div style={{ fontSize: '0.8rem', color: '#999', margin: '8px 0 4px' }}>
          <strong>🏆 지역별 랭킹</strong>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', fontSize: '0.7rem' }}>
          <a href="/ranking/서울" style={{ color: '#666', textDecoration: 'none' }}>서울 급식랭킹</a>
          <a href="/ranking/경기" style={{ color: '#666', textDecoration: 'none' }}>경기 급식랭킹</a>
          <a href="/ranking/인천" style={{ color: '#666', textDecoration: 'none' }}>인천 급식랭킹</a>
          <a href="/ranking/부산" style={{ color: '#666', textDecoration: 'none' }}>부산 급식랭킹</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
