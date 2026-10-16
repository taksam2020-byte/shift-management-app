'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

// 通知から開いたときの入口。ログイン中の人の画面へ移動する
export default function Redirect() {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (user) router.replace(`/my-schedule/${user.id}`);
  }, [user, router]);
  return <div className="flex h-screen items-center justify-center">読み込み中...</div>;
}
