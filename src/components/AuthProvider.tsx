'use client';

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const publicRoutes = ['/', '/admin/login', '/employee/login', '/viewer/login'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);
      try {
        let user = localStorage.getItem('loggedInUser');
        
        if (user) {
          setIsAuthenticated(true);
        } else {
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
              setIsAuthenticated(true);
              user = 'true';
            } else {
              localStorage.removeItem('authToken');
              setIsAuthenticated(false);
            }
          } else {
            setIsAuthenticated(false);
          }
        }

        const isPublicPage = publicRoutes.includes(pathname);

        if (user && isPublicPage) {
          router.push('/dashboard');
        } else if (!user && !isPublicPage) {
          router.push('/');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('loggedInUser');
        localStorage.removeItem('authToken');
        setIsAuthenticated(false);
        if (!publicRoutes.includes(pathname)) {
            router.push('/');
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [pathname, router]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading }}>
      {isLoading ? <div className="flex h-screen items-center justify-center">読み込み中...</div> : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
