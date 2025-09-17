'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Publicly accessible routes
const publicRoutes = ['/', '/admin/login', '/employee/login'];

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      let user = localStorage.getItem('loggedInUser');
      
      if (user) {
        setIsAuthenticated(true);
      } else {
        const token = localStorage.getItem('authToken');
        if (token) {
          try {
            const response = await fetch('/api/auth/verify-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token }),
            });
            if (response.ok) {
              const { user: userData } = await response.json();
              localStorage.setItem('loggedInUser', JSON.stringify(userData));
              setIsAuthenticated(true);
              user = 'true'; // Set user to a truthy value for the next check
            } else {
              localStorage.removeItem('authToken');
              setIsAuthenticated(false);
            }
          } catch (e) {
            localStorage.removeItem('authToken');
            setIsAuthenticated(false);
          }
        }
      }

      // --- Redirection Logic ---
      const isPublicPage = publicRoutes.includes(pathname);

      if (user && isPublicPage) {
        // If user is logged in and tries to access a public page (like login), redirect to dashboard
        router.push('/dashboard');
      } else if (!user && !isPublicPage) {
        // If user is not logged in and tries to access a private page, redirect to home
        router.push('/');
      } else {
        // Otherwise, loading is complete
        setIsLoading(false);
      }
    };

    checkAuth();

  }, [pathname, router]);

  // While checking auth, or if redirecting, show a loading screen.
  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">読み込み中...</div>;
  }

  return <>{children}</>;
}
