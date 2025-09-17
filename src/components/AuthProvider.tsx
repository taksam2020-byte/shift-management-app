'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isVerifying, setIsVerifying] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const verifyAuth = async () => {
      const loggedInUser = localStorage.getItem('loggedInUser');
      // If user is already logged in, no need to verify token
      if (loggedInUser) {
        setIsVerifying(false);
        return;
      }

      const authToken = localStorage.getItem('authToken');
      // If no token, nothing to do
      if (!authToken) {
        setIsVerifying(false);
        return;
      }

      // Token exists, let's verify it
      try {
        const response = await fetch('/api/auth/verify-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: authToken }),
        });

        if (response.ok) {
          const { user } = await response.json();
          localStorage.setItem('loggedInUser', JSON.stringify(user));
          // Redirect to dashboard only if not already there or on a public page
          if (!['/dashboard'].includes(pathname)) {
            router.push('/dashboard');
          }
        } else {
          // Token is invalid, remove it
          localStorage.removeItem('authToken');
        }
      } catch (error) {
        console.error('Token verification failed:', error);
        localStorage.removeItem('authToken');
      } finally {
        setIsVerifying(false);
      }
    };

    verifyAuth();
  }, [pathname, router]);

  // While verifying, show a loading indicator to prevent flicker
  if (isVerifying) {
    return <div className="flex h-screen items-center justify-center">読み込み中...</div>;
  }

  return <>{children}</>;
}