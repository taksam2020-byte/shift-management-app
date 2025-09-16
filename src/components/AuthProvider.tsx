'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isVerifying, setIsVerifying] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const verifyToken = async () => {
      const authToken = localStorage.getItem('authToken');
      const loggedInUser = localStorage.getItem('loggedInUser');

      // If user is already logged in via session, or on a public page, do nothing
      if (loggedInUser || ['/', '/admin/login', '/employee/login'].includes(pathname)) {
        setIsVerifying(false);
        return;
      }

      if (authToken) {
        try {
          const response = await fetch('/api/auth/verify-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: authToken }),
          });

          if (response.ok) {
            const { user } = await response.json();
            localStorage.setItem('loggedInUser', JSON.stringify(user));
            // Redirect to dashboard after successful token login
            router.push('/dashboard');
          } else {
            // Token is invalid, remove it
            localStorage.removeItem('authToken');
          }
        } catch (error) {
          console.error('Token verification failed:', error);
        }
      }
      setIsVerifying(false);
    };

    verifyToken();
  }, [pathname, router]);

  if (isVerifying) {
    return <div className="flex h-screen items-center justify-center">読み込み中...</div>;
  }

  return <>{children}</>;
}
