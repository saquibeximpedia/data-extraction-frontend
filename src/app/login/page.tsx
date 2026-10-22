'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import { Login } from '@/components/Login';

export default function LoginPage() {
  const { auth, authError } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (auth === 'in') router.replace('/');
  }, [auth, router]);

  if (auth === 'checking' || auth === 'in') return null;
  return <Login notice={authError} />;
}
