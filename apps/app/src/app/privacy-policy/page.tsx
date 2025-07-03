'use client';

import React from 'react';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">개인정보 처리방침</h1>
      
      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mb-3">1. 개인정보의 처리 목적</h2>
          <p className="mb-2">
            썬드림 주식회사(이하 '회사')는 다음의 목적을 위하여 개인정보를 처리하고 있으며, 
            다음의 목적 이외의 용도로는 이용하지 않습니다.
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>회원 가입 및 관리</li>
            <li>서비스 제공 및 콘텐츠 이용</li>
            <li><strong>학생 나이대 확인 및 학생 전용 서비스 제공</strong>
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li>생일 및 출생년도를 통한 학생 연령대 확인</li>
                <li>학교, 학년, 반 정보 설정 권한 부여</li>
                <li>학생들만이 이용할 수 있는 전용 콘텐츠 및 서비스 제공</li>
                <li>학생 대상 맞춤형 교육 서비스 제공</li>
              </ul>
            </li>
            <li>서비스 개선 및 개발</li>
            <li>마케팅 및 광고에의 활용</li>
            <li>법령 및 정책에 따른 공공기관의 요청 시 제공</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">2. 개인정보의 처리 및 보유 기간</h2>
          <p className="mb-2">
            회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 
            동의 받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>회원 가입 및 관리: 회원 탈퇴 시까지</li>
            <li>서비스 이용 기록: 서비스 종료 후 3개월까지</li>
            <li>법령에 따른 보존 필요 정보: 관련 법령에서 정한 기간</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">3. 정보주체의 권리·의무 및 그 행사방법</h2>
          <p className="mb-2">
            이용자는 개인정보주체로서 다음과 같은 권리를 행사할 수 있습니다.
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>개인정보 열람 요구</li>
            <li>오류 등이 있을 경우 정정 요구</li>
            <li>삭제 요구</li>
            <li>처리정지 요구</li>
          </ul>
          <p className="mt-2">
            위 권리 행사는 회사에 대해 서면, 전화, 전자우편, 모사전송(FAX) 등을 통하여 하실 수 있으며 
            회사는 이에 대해 지체 없이 조치하겠습니다.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">4. 처리하는 개인정보의 항목</h2>
          <p className="mb-2">회사는 다음의 개인정보 항목을 처리하고 있습니다.</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>필수항목: 이메일 주소, 닉네임, 프로필 이미지</li>
            <li><strong>학생 서비스 이용을 위한 선택항목:</strong>
              <ul className="list-disc pl-6 mt-1 space-y-1">
                <li><strong>생일 (생년월일)</strong>: 학생 연령대 확인 및 학생 전용 서비스 제공 목적</li>
                <li><strong>출생년도</strong>: 학생 연령대 확인 및 학생 전용 서비스 제공 목적</li>
                <li><strong>학교 정보 (학교명, 학년, 반)</strong>: 학생 대상 맞춤형 교육 서비스 제공 목적</li>
              </ul>
            </li>
            <li>자동 수집 항목: 서비스 이용 기록, IP 주소, 쿠키, 접속 로그</li>
          </ul>
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>주의:</strong> 생일 및 출생년도 정보는 학생 연령대 확인을 통해 학생들만이 이용할 수 있는 전용 콘텐츠와 서비스(학교/학년/반 설정 기능 등)를 제공하기 위한 목적으로만 사용됩니다.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">5. 개인정보의 파기</h2>
          <p className="mb-2">
            회사는 원칙적으로 개인정보 처리목적이 달성된 경우에는 지체없이 해당 개인정보를 파기합니다. 
            파기의 절차, 기한 및 방법은 다음과 같습니다.
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>파기절차: 이용자가 입력한 정보는 목적 달성 후 별도의 DB에 옮겨져 내부 방침 및 기타 관련 법령에 따라 일정기간 저장된 후 혹은 즉시 파기됩니다.</li>
            <li>파기기한: 이용자의 개인정보는 개인정보의 보유기간이 경과된 경우에는 보유기간의 종료일로부터 5일 이내에, 개인정보의 처리 목적 달성, 해당 서비스의 폐지, 사업의 종료 등 그 개인정보가 불필요하게 되었을 때에는 개인정보의 처리가 불필요한 것으로 인정되는 날로부터 5일 이내에 그 개인정보를 파기합니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">6. 개인정보 보호책임자</h2>
          <p className="mb-2">
            회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 
            피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
          </p>
          <div className="pl-6">
            <p>▶ 개인정보 보호책임자</p>
            <p>성명: 백은숙</p>
            <p>직책: 대표</p>
            <p>연락처: 010-2597-7502, beakes@naver.com</p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">7. 개인정보 처리방침 변경</h2>
          <p>
            이 개인정보처리방침은 2025년 7월 3일부터 적용됩니다. 법령 및 방침에 따른 변경내용의 추가, 삭제 및 
            정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
          </p>
        </section>
      </div>

      <div className="mt-8">
        <Link href="/" className="text-indigo-600 hover:text-indigo-800">
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
