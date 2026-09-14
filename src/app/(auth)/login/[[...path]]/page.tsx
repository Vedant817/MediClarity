"use client"
import React, { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SignIn, useUser } from '@clerk/nextjs'
import { safeRedirectTarget } from '@/lib/redirect'

const LoginForm = () => {
  const { isSignedIn, user, isLoaded } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = safeRedirectTarget(searchParams.get("redirect_url"));

  useEffect(() => {
    if (isSignedIn && isLoaded) {
      router.push(redirectUrl);
    }
  }, [isSignedIn, isLoaded, user, router, redirectUrl]);

  if (!isLoaded) {
    return <div className='flex flex-col items-center justify-center h-screen'>Loading...</div>
  }

  return (
    <div className='flex items-center justify-center h-screen'>
      <SignIn fallbackRedirectUrl={redirectUrl} />
    </div>
  )
}

const Login = () => (
  <Suspense fallback={<div className='flex flex-col items-center justify-center h-screen'>Loading...</div>}>
    <LoginForm />
  </Suspense>
)

export default Login
