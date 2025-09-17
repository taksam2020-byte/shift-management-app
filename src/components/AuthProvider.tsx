'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Publicly accessible routes
const publicRoutes = ['/', '/admin/login', '/employee/login'];

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        let user = localStorage.getItem('loggedInUser');
        
        if (!user) {
          const token = localStorage.getItem('authToken');
          if (token) {
            const response = await fetch('/api/auth/verify-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token }),
            });
            if (response.ok) {
              const { user: userData } = await response.json();
              localStorage.setItem('loggedInUser', JSON.stringify(userData));
              user = 'true'; // Set user to a truthy value for the next check
            } else {
              localStorage.removeItem('authToken');
            }
          }
        }

        // --- Redirection Logic ---
        const isPublicPage = publicRoutes.includes(pathname);

        if (user && isPublicPage) {
          router.push('/dashboard');
        } else if (!user && !isPublicPage) {
          router.push('/');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        // In case of error, clear auth data and redirect to home
        localStorage.removeItem('loggedInUser');
        localStorage.removeItem('authToken');
        if (!publicRoutes.includes(pathname)) {
            router.push('/');
        }
      } finally {
        // Always finish loading
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [pathname]);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">読み込み中...</div>;
  }

  return <>{children}</>;
}