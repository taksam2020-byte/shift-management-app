import type { MetadataRoute } from 'next';

// ホーム画面に追加したときのアプリ名・アイコン・色の設定（PWA）
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'シフトくん',
    short_name: 'シフトくん',
    description: 'パートタイマーのシフト作成・管理アプリ',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#f9fafb',
    theme_color: '#1f2937',
    lang: 'ja',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
