'use client';

import { useCallback, useEffect } from 'react';

const MESSAGE = '保存していない変更があります。移動すると変更は消えます。よろしいですか？';

/**
 * 保存していない変更があるとき、画面を離れる前に確認を出す。
 * - ブラウザを閉じる・再読み込みする: ブラウザ標準の確認
 * - メニューなど画面内のリンクを押す: 確認ダイアログ
 * 戻り値の confirmDiscard() は、月の切り替えなど画面内の操作の前に呼ぶ（true なら続けてよい）
 */
export function useUnsavedChanges(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest('a');
      if (!anchor || !anchor.href || anchor.target === '_blank') return;
      const url = new URL(anchor.href, window.location.href);
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm(MESSAGE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    // Next.js の Link より先に受け取るため capture で登録する
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [isDirty]);

  return useCallback(() => !isDirty || window.confirm(MESSAGE), [isDirty]);
}
