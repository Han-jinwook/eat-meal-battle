'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Profile() {
  const [user, setUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [dbStatus, setDbStatus] = useState<'loading' | 'success' | 'error' | null>(null)
  const [schoolInfo, setSchoolInfo] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

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
          
          // 사용자 테이블과 학교 정보를 병렬로 가져오기 (성능 개선)
          setDbStatus('loading')
          const [profileResult, schoolResult] = await Promise.allSettled([
            supabase.from('users').select('*').eq('id', user.id).single(),
            supabase.from('school_infos').select('*').eq('user_id', user.id).single()
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          {/* 로딩 스피너 */}
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">프로필 로딩 중...</div>
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
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold">내 프로필</h1>
          <Link
            href="/"
            className="text-sm text-gray-500"
          >
            닫기
          </Link>
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
            <div className="text-xl font-bold mb-1">센드림</div>
            <div className="font-medium">{user?.email || '이메일 없음'}</div>
            <div className="text-sm text-gray-500 mt-1">
              {user?.app_metadata?.provider || 'Google'} / {user?.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : ''} 계정 생성
            </div>
          </div>
        </div>

        {/* 학교 정보 - 간결하게 표시 */}
        <div className="mb-8 border-t border-b py-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold">학교정보</h2>
            <Link
              href="/school-search"
              className="px-4 py-2 bg-green-600 text-white rounded-md text-base font-medium hover:bg-green-700 shadow-sm"
            >
              학교설정
            </Link>
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

        <div className="flex justify-center gap-4 mt-6">
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
      </div>
    </div>
  )
}
