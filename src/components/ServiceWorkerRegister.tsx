'use client';

import { useEffect } from 'react';

// 通知を受け取るためのサービスワーカー（public/sw.js）を登録する
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error) => console.error('Service worker registration failed:', error));
    }
  }, []);
  return null;
}
