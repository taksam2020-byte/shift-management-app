'use client';

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export interface ClientUser {
  id: number;
  name: string;
  isAdmin: boolean;
  isViewer?: boolean;
  request_type?: 'holiday' | 'work';
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: ClientUser | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const publicRoutes = ['/', '/admin/login', '/employee/login'];

type Role = 'admin' | 'employee' | 'viewer';
const roleOf = (user: ClientUser): Role => (user.isAdmin ? 'admin' : user.isViewer ? 'viewer' : 'employee');

// 画面ごとに開ける権限（ここに無い画面はログインしていれば誰でも開ける）
const routeRoles: { prefix: string; roles: Role[] }[] = [
  { prefix: '/admin/reports', roles: ['admin', 'viewer'] },
  { prefix: '/admin/manual', roles: ['admin', 'viewer'] },
  { prefix: '/admin', roles: ['admin'] },
  { prefix: '/my-schedule', roles: ['admin', 'employee'] },
  { prefix: '/requests', roles: ['employee'] },
  { prefix: '/employee/reports', roles: ['employee'] },
];

export function canOpen(user: ClientUser, pathname: string): boolean {
  const rule = routeRoles.find(r => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  if (!rule || !rule.roles.includes(roleOf(user))) return !rule;
  // 従業員は自分の画面だけ（URLの番号を書き換えて他人の画面を開けないようにする）
  if (roleOf(user) === 'employee') {
    const match = pathname.match(/^\/(my-schedule|requests)\/([^/]+)/);
    if (match && match[2] !== String(user.id)) return false;
  }
  return true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<ClientUser | null>(null);
  // どのページに対してログイン確認が済んでいるか（確認が終わるまでは画面を出さない）
  const [checkedPath, setCheckedPath] = useState<string | null>(null);

  // ログイン状態はサーバー（クッキー）に問い合わせて確認する。ページを移動するたびに確認し直す
  useEffect(() => {
    let cancelled = false;
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        const data = response.ok ? await response.json() : { user: null };
        if (cancelled) return;
        if (data.user) {
          localStorage.setItem('loggedInUser', JSON.stringify(data.user));
        } else {
          localStorage.removeItem('loggedInUser');
        }
        localStorage.removeItem('authToken'); // 旧方式の名残を削除
        setUser(data.user);
      } catch (error) {
        console.error('Auth check failed:', error);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setCheckedPath(pathname);
      }
    };
    checkAuth();
    return () => { cancelled = true; };
  }, [pathname]);

  const isPublicPage = publicRoutes.includes(pathname);
  const checked = checkedPath === pathname;
  const redirectTo = !checked
    ? null
    : user
      ? (isPublicPage || !canOpen(user, pathname) ? '/dashboard' : null)
      : (isPublicPage ? null : '/');

  useEffect(() => {
    if (redirectTo && redirectTo !== pathname) router.replace(redirectTo);
  }, [redirectTo, pathname, router]);

  const isLoading = !checked || (!!redirectTo && redirectTo !== pathname);

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!user, isLoading, user }}>
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
