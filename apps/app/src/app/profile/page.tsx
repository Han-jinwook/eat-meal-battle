'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useReferralCode } from '@/hooks/useReferralCode'
import BirthConsentModal from '@/components/BirthConsentModal'

export default function Profile() {
  const [user, setUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [dbStatus, setDbStatus] = useState<'loading' | 'success' | 'error' | null>(null)
  const [schoolInfo, setSchoolInfo] = useState<any>(null)
  const [referredUsers, setReferredUsers] = useState<any[]>([])
  const [referralLoading, setReferralLoading] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showBirthConsentModal, setShowBirthConsentModal] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { referralCode, nickname } = useReferralCode()

  useEffect(() => {
    const getUser = async () => {
      try {
        setLoading(true)
        
        // 세션 및 사용자 정보 가져오기
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error) {
          console.error('사용자 인증 에러:', error)
          throw error
        }
        
        if (user) {
          console.log('인증된 사용자 정보:', user)
          setUser(user)
          
          // 모든 데이터를 병렬로 가져오기 (성능 개선)
          setDbStatus('loading')
          const [profileResult, schoolResult, referralResult] = await Promise.allSettled([
            supabase.from('users').select('*').eq('id', user.id).single(),
            supabase.from('school_infos').select('*').eq('user_id', user.id).single(),
            fetchReferredUsers(user.id)
          ])
          
          // 사용자 프로필 처리
          if (profileResult.status === 'fulfilled' && !profileResult.value.error) {
            console.log('사용자 DB 프로필:', profileResult.value.data)
            setUserProfile(profileResult.value.data)
            setDbStatus('success')
          } else {
            console.error('사용자 프로필 조회 에러:', profileResult.value?.error)
            setDbStatus('error')
            if (profileResult.value?.error?.code !== 'PGRST116') {
              setError(`DB 조회 에러: ${profileResult.value?.error?.message}`)
            }
          }
          
          // 학교 정보 처리
          if (schoolResult.status === 'fulfilled' && !schoolResult.value.error) {
            setSchoolInfo(schoolResult.value.data)
          }

          // 추천 회원 목록은 이미 fetchReferredUsers에서 처리됨
        } else {
          router.push('/login')
        }
      } catch (error: any) {
        console.error('프로필 로딩 에러:', error)
        setError(error.message || '사용자 정보를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    getUser()
  }, [supabase, router])

  // 추천한 회원 목록 가져오기 함수
  const fetchReferredUsers = async (userId: string) => {
    try {
      setReferralLoading(true)
      
      const { data, error } = await supabase
        .from('referrals')
        .select(`
          created_at,
          users!referee_id(nickname, email)
        `)
        .eq('referrer_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('추천 회원 목록 조회 에러:', error)
        throw error // Promise.allSettled에서 처리할 수 있도록 에러 던지기
      }

      setReferredUsers(data || [])
      return data || []
    } catch (error) {
      console.error('추천 회원 목록 가져오기 실패:', error)
      throw error
    } finally {
      setReferralLoading(false)
    }
  }

  // 친구에게 공유하기 함수
  const handleShareApp = async () => {
    if (isSharing) return;
    setIsSharing(true);
    
    try {
      const referrerText = nickname ? `${nickname}님이 추천하는 ` : '';
      const shareTitle = `🍽️ 급식배틀 - 우리학교 급식 평가 앱! 🏆`;
      const shareText = `${referrerText}친구들과 함께 급식을 평가하고 배틀해보세요! 메뉴별 평점, 학교별 순위, 퀴즈까지!\n#급식배틀 #학교급식 #급식평가 #메뉴평가`;
      
      // 앱 홈으로 콜백하는 URL
      const baseUrl = window.location.origin;
      let shareUrl = baseUrl;
      
      // 추천 코드 추가
      if (referralCode) {
        shareUrl += `?ref=${referralCode}`;
      }
      
      // 모바일 체크
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (navigator.share && isMobile) {
        // 모바일: 바로 네이티브 공유
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
      } else {
        // PC: 클립보드 복사 + 성공 모달
        const fullShareContent = `${shareTitle}\n\n${shareText}\n\n${shareUrl}`;
        await navigator.clipboard.writeText(fullShareContent);
        setShowSuccessModal(true);
      }
    } catch (error) {
      console.error('공유 중 오류 발생:', error);
      alert('공유 중 문제가 발생했습니다.');
    } finally {
      setIsSharing(false);
    }
  };

  // 로그아웃 처리 함수
  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      router.push('/')
    } catch (error: any) {
      setError(error.message || '로그아웃 중 오류가 발생했습니다')
    }
  }

  // 회원 탈퇴 처리 함수
  const handleDeleteAccount = async () => {
    if (!confirm('정말로 계정을 삭제하시겠습니까? \n\n이 작업은 되돌릴 수 없으며, 모든 계정 데이터가 영구적으로 삭제됩니다.')) {
      return
    }

    try {
      setDeletingAccount(true)
      setError(null)
      
      console.log('회원 탈퇴 시작...')
      
      // 현재 사용자 정보 가져오기
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }
      
      // Step 1: API 호출로 DB 데이터 삭제 (코드 중복 제거)
      console.log('회원 탈퇴 API 호출')
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: user.id })
      })
      
      // API 응답 처리
      const responseData = await response.json()
      console.log('API 응답:', responseData)
      
      if (!response.ok) {
        throw new Error(responseData.error || '계정 삭제 중 API 오류가 발생했습니다.')
      }
      
      // Step 2: 로그아웃 처리 - 이것이 실제 사용자 삭제를 트리거합니다
      console.log('로그아웃 처리 시작...')
      const { error: signOutError } = await supabase.auth.signOut()
      
      if (signOutError) {
        console.error('로그아웃 오류:', signOutError)
        throw new Error(`로그아웃 오류: ${signOutError.message}`)
      }
      
      // Step 3: 성공 메시지 표시
      alert('회원 탈퇴가 성공적으로 완료되었습니다.')
      
      // Step 4: 홈페이지로 리다이렉트
      router.push('/')
    } catch (error: any) {
      console.error('계정 삭제 중 오류 발생:', error)
      setError(error.message || '계정 삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingAccount(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col p-4">
        <div className="mx-auto w-full max-w-md">
          <div className="flex justify-between items-center mb-4">
            <div className="h-6 bg-gray-200 rounded w-20 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-8 animate-pulse"></div>
          </div>

          {/* 사용자 기본 정보 스켈레톤 */}
          <div className="mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse"></div>
            </div>
            <div className="text-center space-y-2">
              <div className="h-6 bg-gray-200 rounded w-24 mx-auto animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-40 mx-auto animate-pulse"></div>
              <div className="h-3 bg-gray-200 rounded w-32 mx-auto animate-pulse"></div>
            </div>
          </div>

          {/* 학교 정보 스켈레톤 */}
          <div className="mb-8 border-t border-b py-4">
            <div className="flex justify-between items-center mb-3">
              <div className="h-5 bg-gray-200 rounded w-16 animate-pulse"></div>
              <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4 animate-pulse"></div>
            </div>
          </div>

          {/* 추천 회원 목록 스켈레톤 */}
          <div className="mb-8 border-b py-4">
            <div className="h-5 bg-gray-200 rounded w-48 mx-auto mb-3 animate-pulse"></div>
            <div className="bg-gray-50 rounded-lg p-3 h-72">
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-md p-3 shadow-sm">
                    <div className="flex justify-between items-center">
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                        <div className="h-3 bg-gray-200 rounded w-32 animate-pulse"></div>
                      </div>
                      <div className="h-3 bg-gray-200 rounded w-16 animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center mt-4">
              <div className="h-8 bg-gray-200 rounded w-32 animate-pulse"></div>
            </div>
          </div>

          <div className="flex justify-center gap-4 mt-12">
            <div className="h-8 bg-gray-200 rounded w-16 animate-pulse"></div>
            <div className="h-8 bg-gray-200 rounded w-16 animate-pulse"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg bg-red-50 p-6 text-center">
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col p-4">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-4">
          <h1 className="text-xl font-bold">내 프로필</h1>
        </div>

        {/* 사용자 기본 정보 - 간결하게 표시 */}
        <div className="mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-orange-500 flex items-center justify-center overflow-hidden border-2 border-orange-600">
              {userProfile?.profile_image ? (
                <img src={userProfile.profile_image} alt="프로필" className="w-full h-full object-cover" />
              ) : (
                <div className="text-white text-2xl font-bold">{user?.email?.charAt(0).toUpperCase()}</div>
              )}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold mb-1">{userProfile?.nickname || user?.user_metadata?.name || '사용자'}</div>
            <div className="font-medium mb-3">{user?.email || '이메일 없음'}</div>
            
            {/* 출생연도와 초대코드 */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* 출생연도 */}
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="text-xs text-blue-600 font-medium mb-1">출생연도</div>
                <div className="text-sm font-semibold text-blue-800">
                  {userProfile?.birth_date 
                    ? new Date(userProfile.birth_date).getFullYear() + '년'
                    : '미설정'
                  }
                </div>
              </div>
              
              {/* 초대코드 */}
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <div className="text-xs text-green-600 font-medium mb-1">초대코드</div>
                <div className="text-sm font-semibold text-green-800 font-mono">
                  {userProfile?.referral_code || '생성중...'}
                </div>
              </div>
            </div>
            
            <div className="text-sm text-gray-500">
              {user?.app_metadata?.provider || 'Google'} / {user?.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : ''} 계정 생성
            </div>
          </div>
        </div>

        {/* 학교 정보 - 간결하게 표시 */}
        <div className="mb-8 border-t border-b py-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold">학교정보</h2>
            {/* 학교설정 버튼 - 스마트 로직 적용 */}
            {userProfile?.birth_date && userProfile?.is_student === false ? (
              // 비학생 확인 완료 → 비활성화
              <button
                disabled
                className="px-4 py-2 bg-gray-400 text-white rounded-md text-base font-medium cursor-not-allowed shadow-sm"
                title="비학생은 학교설정을 할 수 없습니다"
              >
                학교설정
              </button>
            ) : (
              // 학생이거나 미확인 → 활성화
              <button
                onClick={() => {
                  // 생년월일 없거나 is_student가 null인 경우 → 나이 인증 모달
                  if (!userProfile?.birth_date || userProfile?.is_student === null) {
                    setShowBirthConsentModal(true);
                  } else {
                    // 학생 확인 완료 → 학교설정 페이지로 이동
                    router.push('/school-search');
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-md text-base font-medium hover:bg-green-700 shadow-sm"
              >
                학교설정
              </button>
            )}
          </div>
          
          {schoolInfo ? (
            <div>
              <div className="text-base font-medium mb-1 flex justify-between">
                <span>{schoolInfo.school_name}</span>
                <span>{schoolInfo.grade}학년 {schoolInfo.class_number}반</span>
              </div>
              <div className="text-sm text-gray-700">
                {schoolInfo.region} {schoolInfo.address && schoolInfo.address.substring(0, 20)}{schoolInfo.address && schoolInfo.address.length > 20 ? '...' : ''}
              </div>
            </div>
          ) : (
            <div className="text-center py-3">
              <Link 
                href="/school-search"
                className="px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 inline-block"
              >
                학교 정보 설정하기
              </Link>
            </div>
          )}
        </div>

        {/* 나의 추천코드로 가입한 회원 목록 */}
        <div className="mb-8 border-b py-4">
          <h2 className="text-lg font-bold mb-3 text-center">나의 추천코드로 가입한 회원 목록</h2>
          
          <div className="bg-gray-50 rounded-lg p-3 h-72 overflow-y-auto">
            {referralLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-500">로딩 중...</div>
              </div>
            ) : referredUsers.length > 0 ? (
              <div className="space-y-2">
                {referredUsers.map((referral, index) => (
                  <div key={index}>
                    <div className="bg-white rounded-md p-3 shadow-sm">
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {referral.users?.nickname || '미설정'}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {referral.users?.email && referral.users.email.length > 25 
                              ? `${referral.users.email.substring(0, 25)}...` 
                              : referral.users?.email || '이메일 없음'}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 ml-2">
                          {new Date(referral.created_at).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                          }).replace(/\./g, '.').replace(/ /g, '')}
                        </div>
                      </div>
                    </div>
                    {index < referredUsers.length - 1 && (
                      <div className="border-b border-gray-200 my-2"></div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <div className="text-sm">아직 추천한 회원이 없습니다</div>
                  <div className="text-xs mt-1">친구들에게 추천코드를 공유해보세요!</div>
                </div>
              </div>
            )}
          </div>
          
          {/* 친구에게 공유하기 버튼 - 항상 표시 */}
          <div className="flex justify-center mt-4">
            <button
              onClick={handleShareApp}
              disabled={isSharing}
              className={`px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center gap-2 text-sm ${isSharing ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
              </svg>
              {isSharing ? '공유 중...' : '친구에게 공유하기'}
            </button>
          </div>
        </div>

        <div className="flex justify-center gap-4 mt-12">
          <button
            onClick={handleSignOut}
            className="rounded-md bg-blue-600 px-4 py-2 text-white text-sm hover:bg-blue-700 transition-colors"
          >
            로그아웃
          </button>
          <button
            onClick={handleDeleteAccount}
            disabled={deletingAccount}
            className="rounded-md bg-red-600 px-4 py-2 text-white text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {deletingAccount ? '삭제 중...' : '회원 탈퇴'}
          </button>
        </div>
        {deletingAccount && (
          <div className="mt-3 text-yellow-700 text-sm text-center">회원 탈퇴 처리 중... 잠시만 기다려주세요.</div>
        )}

        {/* PC 전용 성공 모달 */}
        {showSuccessModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-sm mx-4 p-6">
              <div className="text-center">
                <div className="mb-4">
                  <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">복사 완료!</h3>
                <p className="text-sm text-gray-600 mb-4">
                  앱 공유 링크가 클립보드에 복사되었습니다.
                </p>
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BirthConsentModal */}
        <BirthConsentModal
          isOpen={showBirthConsentModal}
          onClose={() => setShowBirthConsentModal(false)}
          onSuccess={() => {
            // 모달 성공 후 프로필 새로고침
            window.location.reload();
          }}
          userId={user?.id || ''}
        />
      </div>
    </div>
  )
}
