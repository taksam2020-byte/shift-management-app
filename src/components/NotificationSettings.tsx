'use client';

import { useCallback, useEffect, useState } from 'react';

type Status = 'loading' | 'unsupported' | 'ios-needs-install' | 'not-configured' | 'denied' | 'off' | 'on';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * 「この端末で通知を受け取る」のオン・オフ切り替え。
 * ダッシュボードと管理者の通知設定画面に表示する。
 */
export default function NotificationSettings({ isAdmin = false }: { isAdmin?: boolean }) {
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!supported) {
      // iPhone は「ホーム画面に追加」したアプリからでないと通知を使えない
      setStatus(isIos() && !isStandalone() ? 'ios-needs-install' : 'unsupported');
      return;
    }
    const res = await fetch('/api/push/public-key').catch(() => null);
    const { publicKey } = res?.ok ? await res.json() : { publicKey: null };
    if (!publicKey) {
      setStatus('not-configured');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    setStatus(subscription ? 'on' : 'off');
  }, []);

  useEffect(() => {
    refresh().catch(() => setStatus('unsupported'));
  }, [refresh]);

  const turnOn = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const { publicKey } = await (await fetch('/api/push/public-key')).json();
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '通知の登録に失敗しました。');
      setStatus('on');
      setMessage('通知をオンにしました。「テスト通知」で届くか確認できます。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '通知の登録に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatus('off');
      setMessage('この端末の通知をオフにしました。');
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(data.sent > 0 ? 'テスト通知を送りました。数秒で届きます。' : '送信できませんでした。いったんオフにして、もう一度オンにしてください。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'テスト通知の送信に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const description = isAdmin
    ? '締切の前日に、希望を提出していない人数をお知らせします。'
    : 'シフトが作成・変更されたときと、希望の締切が近づいたときにお知らせします。';

  return (
    <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md border border-gray-200">
      <h2 className="text-lg font-bold text-gray-800 mb-1">🔔 スマホ通知</h2>
      <p className="text-sm text-gray-600 mb-3">{description}</p>

      {status === 'loading' && <p className="text-sm text-gray-500">確認中...</p>}
      {status === 'unsupported' && <p className="text-sm text-gray-600">このブラウザは通知に対応していません。スマホの場合は Chrome（Android）か Safari（iPhone）で開いてください。</p>}
      {status === 'ios-needs-install' && (
        <div className="text-sm text-gray-700 space-y-1">
          <p>iPhone で通知を受け取るには、先にホーム画面に追加してください。</p>
          <ol className="list-decimal list-inside">
            <li>Safari の画面下にある共有ボタン（□に↑のマーク）を押す</li>
            <li>「ホーム画面に追加」を押す</li>
            <li>ホーム画面にできた「シフトくん」から開き直し、この画面で通知をオンにする</li>
          </ol>
          <p className="text-gray-500">※ iOS 16.4 以降が必要です。</p>
        </div>
      )}
      {status === 'not-configured' && <p className="text-sm text-gray-600">通知の準備がまだできていません（管理者による設定待ち）。</p>}
      {status === 'denied' && <p className="text-sm text-gray-700">通知がブロックされています。端末の「設定」でこのアプリ（またはブラウザ）の通知を許可してから、画面を開き直してください。</p>}
      {(status === 'off' || status === 'on') && (
        <div className="flex flex-wrap items-center gap-3">
          <span className={`text-sm font-bold ${status === 'on' ? 'text-green-600' : 'text-gray-500'}`}>{status === 'on' ? 'この端末：オン' : 'この端末：オフ'}</span>
          {status === 'off' ? (
            <button onClick={turnOn} disabled={busy} className="py-1.5 px-4 bg-blue-500 text-white text-sm font-bold rounded hover:bg-blue-600 disabled:bg-gray-400">通知をオンにする</button>
          ) : (
            <>
              <button onClick={sendTest} disabled={busy} className="py-1.5 px-4 bg-green-500 text-white text-sm font-bold rounded hover:bg-green-600 disabled:bg-gray-400">テスト通知</button>
              <button onClick={turnOff} disabled={busy} className="py-1.5 px-4 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 disabled:opacity-50">オフにする</button>
            </>
          )}
        </div>
      )}
      {message && <p className="text-sm text-blue-700 mt-2">{message}</p>}
    </div>
  );
}
