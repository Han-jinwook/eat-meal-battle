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
          
          // 사용자 테이블에서 메타데이터 가져오기
          setDbStatus('loading')
          const { data, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single()
          
          if (profileError) {
            console.error('사용자 프로필 조회 에러:', profileError)
            setDbStatus('error')
            if (profileError.code !== 'PGRST116') { // No records found 에러가 아닐 경우에만 에러 표시
              setError(`DB 조회 에러: ${profileError.message}`)
            }
          } else if (data) {
            console.log('사용자 DB 프로필:', data)
            setUserProfile(data)
            setDbStatus('success')
            
            // 학교 정보 가져오기 - user_id로 직접 조회
            const { data: schoolData, error: schoolError } = await supabase
              .from('school_infos')
              .select('*')
              .eq('user_id', user.id)
              .single()
              
            if (!schoolError && schoolData) {
              setSchoolInfo(schoolData)
            }
          } else {
            setDbStatus('error')
            setError('사용자 데이터를 찾을 수 없습니다. DB에 저장되지 않았을 수 있습니다.')
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
      
      // Step 1: API 호출로 DB 데이터 삭제 (코드 중복 제거)
      console.log('회원 탈퇴 API 호출')
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
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
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto"></div>
          <p className="text-gray-600">로딩 중...</p>
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
        <div className="mb-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center overflow-hidden">
              {userProfile?.profile_image ? (
                <img src={userProfile.profile_image} alt="프로필" className="w-full h-full object-cover" />
              ) : (
                <div className="text-white text-xl font-bold">{user?.email?.charAt(0).toUpperCase()}</div>
              )}
            </div>
          </div>
          <div className="text-center mb-2">
            <div className="font-medium">{user?.email || '이메일 없음'}</div>
            <div className="text-sm text-gray-500">
              {user?.app_metadata?.provider || 'Google'} / {user?.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : ''} 계정 생성
            </div>
          </div>
        </div>

        {/* 학교 정보 - 간결하게 표시 */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-base font-medium">학교정보</h2>
            <Link
              href="/school-search"
              className="text-xs text-blue-600"
            >
              학교정보수정
            </Link>
          </div>
          
          {schoolInfo ? (
            <div>
              <div className="mb-1">
                {schoolInfo.school_name} / {schoolInfo.region} {schoolInfo.address && schoolInfo.address.substring(0, 15)}...
              </div>
              <div className="text-sm">
                {schoolInfo.grade}학년 {schoolInfo.class_number}반
              </div>
            </div>
          ) : (
            <div>
              <Link 
                href="/school-search"
                className="text-sm text-blue-600"
              >
                학교 정보 설정하기
              </Link>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleSignOut}
            className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
          >
            로그아웃
          </button>
          <button
            onClick={handleDeleteAccount}
            disabled={deletingAccount}
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deletingAccount ? '삭제 중...' : '회원 탈퇴'}
          </button>
        </div>
        {deletingAccount && (
          <div className="mt-2 text-yellow-700 text-sm">회원 탈퇴 처리 중... 잠시만 기다려주세요.</div>
        )}
      </div>
    </div>
  )
}
