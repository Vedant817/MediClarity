"use client"
import React, { useEffect } from 'react'
import { SignUp, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

const Register = () => {
  const { isSignedIn, user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn && isLoaded) {
      router.replace('/dashboard');
    }
  }, [isSignedIn, isLoaded, user]);

  if (!isLoaded) {
    return <div className='flex flex-col items-center justify-center h-screen'>Loading...</div>
  }

  return (
    <div className='flex items-center justify-center h-screen'>
      <SignUp />
    </div>
  )
}

export default Register;