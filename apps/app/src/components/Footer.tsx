import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer style={{ fontSize: '0.85rem', color: '#888', padding: '16px 0', textAlign: 'center', background: '#fafbfc', lineHeight: 1.7 }}>
      <div>
        <strong>법인명(상호)</strong> : 썬트립 주식회사 &nbsp;|
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
    </footer>
  );
};

export default Footer;
