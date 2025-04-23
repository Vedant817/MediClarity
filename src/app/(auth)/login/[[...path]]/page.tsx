"use client"
import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SignIn, useUser } from '@clerk/nextjs'

const Login = () => {
  const { isSignedIn, user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn && isLoaded) {
      router.push('/dashboard');
    }
  }, [isSignedIn, isLoaded, user, router]);

  if (!isLoaded) {
    return <div className='flex flex-col items-center justify-center h-screen'>Loading...</div>
  }

  return (
    <div className='flex items-center justify-center h-screen'>
      <SignIn />
    </div>
  )
}

export default Login