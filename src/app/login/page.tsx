'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/lib/store';
import { Login } from '@/components/Login';

function LoginScreen() {
  const { auth, login } = useApp();
  const router = useRouter();
  const expired = useSearchParams().get('expired') === '1';

  useEffect(() => {
    if (auth === 'in') router.replace('/');
  }, [auth, router]);

  if (auth === 'checking' || auth === 'in') return null;
  return <Login onToken={login} notice={expired ? 'Your session expired. Sign in again.' : undefined} />;
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  );
}
