"use client"
import React, { Suspense, useEffect } from 'react'
import { SignUp, useUser } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { safeRedirectTarget } from '@/lib/redirect'

const RegisterForm = () => {
  const { isSignedIn, user, isLoaded } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = safeRedirectTarget(searchParams.get("redirect_url"));

  useEffect(() => {
    if (isSignedIn && isLoaded) {
      router.replace(redirectUrl);
    }
  }, [isSignedIn, isLoaded, user, router, redirectUrl]);

  if (!isLoaded) {
    return <div className='flex flex-col items-center justify-center h-screen'>Loading...</div>
  }

  return (
    <div className='flex items-center justify-center h-screen'>
      <SignUp fallbackRedirectUrl={redirectUrl} />
    </div>
  )
}

const Register = () => (
  <Suspense fallback={<div className='flex flex-col items-center justify-center h-screen'>Loading...</div>}>
    <RegisterForm />
  </Suspense>
)

export default Register;
