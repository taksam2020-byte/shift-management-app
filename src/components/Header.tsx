'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

import { useAuth } from '@/components/AuthProvider';

interface User {
  id: number;
  name: string;
  isAdmin: boolean;
  request_type?: 'holiday' | 'work';
}

export default function Header() {
  const { isAuthenticated } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isAuthenticated) {
      const storedUser = localStorage.getItem('loggedInUser');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } else {
      setUser(null);
    }
    setIsMenuOpen(false);
  }, [pathname, isAuthenticated]);

  const handleLogout = () => {
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('authToken');
    setUser(null);
    // Reload the page to re-trigger the auth flow
    window.location.href = '/';
  };

  const activeClass = "text-white font-bold";
  const inactiveClass = "text-gray-400 hover:text-white";
  const requestLinkText = user?.request_type === 'work' ? '希望出勤日の提出' : '希望休の提出';

  const AdminLinks = () => (
    <>
      <li><Link href="/admin/schedule" className={pathname === '/admin/schedule' ? activeClass : inactiveClass}>シフト作成</Link></li>
      <li><Link href="/admin/employees" className={pathname === '/admin/employees' ? activeClass : inactiveClass}>従業員管理</Link></li>
      <li><Link href="/admin/reports/monthly" className={pathname === '/admin/reports/monthly' ? activeClass : inactiveClass}>月次レポート</Link></li>
      <li><Link href="/admin/holidays" className={pathname === '/admin/holidays' ? activeClass : inactiveClass}>休業日設定</Link></li>
      <li><Link href="/schedule/view" className={pathname === '/schedule/view' ? activeClass : inactiveClass}>全体シフト確認</Link></li>
    </>
  );

  const EmployeeLinks = () => (
    <>
      <li><Link href={`/my-schedule/${user!.id}`} className={pathname === `/my-schedule/${user!.id}` ? activeClass : inactiveClass}>マイシフト</Link></li>
      <li><Link href={`/requests/${user!.id}`} className={pathname === `/requests/${user!.id}` ? activeClass : inactiveClass}>{requestLinkText}</Link></li>
      <li><Link href="/schedule/view" className={pathname === '/schedule/view' ? activeClass : inactiveClass}>全体シフト確認</Link></li>
    </>
  );

  return (
    <header className="bg-gray-800 text-white shadow-md sticky top-0 z-20">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        {/* Left Side */}
        <div className="flex items-center gap-4">
          <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo" width={52} height={52} className="rounded-md" />
            <span className="text-lg font-bold hover:text-gray-300">シフトくん</span>
          </Link>
          {user && (
              <nav className="hidden md:block">
                  <ul className="flex items-center gap-6 text-sm pl-1">
                      {user.isAdmin ? <AdminLinks /> : <EmployeeLinks />}
                  </ul>
              </nav>
          )}
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-4">
          {user && (
              <div className="hidden md:flex items-center gap-4">
                  <span className="text-sm">{user.name} さん</span>
                  <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-md text-sm">ログアウト</button>
              </div>
          )}
          {user && (
              <div className="md:hidden">
                  <button onClick={() => setIsMenuOpen(!isMenuOpen)}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                  </button>
              </div>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && user && (
        <div className="md:hidden bg-gray-700 border-t border-gray-600">
            <nav className="container mx-auto px-4 pb-4 pt-2">
                <ul className="flex flex-col gap-4 text-base">
                    {user.isAdmin ? <AdminLinks /> : <EmployeeLinks />}
                    <li><hr className="border-gray-600" /></li>
                    <li>
                        <div className="flex justify-between items-center">
                            <span className="text-sm">{user.name} さん</span>
                            <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-md text-sm">ログアウト</button>
                        </div>
                    </li>
                </ul>
            </nav>
        </div>
      )}
    </header>
  );
}
