'use client';

import React from 'react';

export default function ManualPage() {
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6 border-b pb-2">シフトくん 使い方ガイド（管理者用）</h1>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <p className="mb-4 text-gray-700">
          このページは、シフト管理ツールの業務を引き継ぐためのマニュアルです。<br/>
          必要に応じて内容を加筆・修正してください。
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4 text-indigo-700">1. 日々の業務（シフト作成）</h2>
        <ul className="list-decimal pl-6 space-y-2 text-gray-700">
          <li>各従業員がスマートフォンから「希望休」または「希望出勤」を提出します。</li>
          <li>管理者は上部メニューの<strong>「シフト作成」</strong>画面を開きます。</li>
          <li>まずは<strong>「仮シフト割当（自動作成）」</strong>ボタンを押して、システムに自動割り当てをさせます。</li>
          <li>その後、自動割り当てされたシフトをベースに、手動で削ったり足したりして調整を行います。</li>
          <li>下部の「理想のペース」バーを見ながら、極端にシフトが多すぎないか（赤線を超えていないか）を確認します。</li>
          <li>最後に<strong>「シフト保存」</strong>を押して確定します。</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-4 text-indigo-700">2. 実績入力と月間集計</h2>
        <ul className="list-decimal pl-6 space-y-2 text-gray-700">
          <li>日々の実績入力は、<strong>毎日退勤時に各従業員が自身の「マイシフト」画面から行います。</strong></li>
          <li>管理者は<strong>「月間集計」</strong>画面を開き、未入力のアラート（黄色いメッセージ）がないか確認します。</li>
          <li>未入力がある場合は、該当の従業員に入力を促します。</li>
          <li>（※管理者メニューにある「実績入力」は、何かあった時のために管理者が代理で入力・修正できる保険的な機能として用意されています。）</li>
          <li>なお、ツール内で表示される「概算給与」はあくまで参考情報です。実際の給与計算には使用しません。</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-4 text-indigo-700">3. 従業員の入社・退職時の処理</h2>
        <h3 className="font-semibold mt-4 mb-2">【入社時（新規登録）】</h3>
        <ul className="list-disc pl-6 space-y-2 text-gray-700">
          <li><strong>「従業員管理」</strong>画面を開きます。</li>
          <li>左側のフォームに、新しい従業員のID、氏名、時給、ログイン用パスワードなどを入力して「追加」を押します。</li>
          <li>登録したIDとパスワードを本人に伝えてください。</li>
        </ul>

        <h3 className="font-semibold mt-4 mb-2">【退職時】</h3>
        <ul className="list-disc pl-6 space-y-2 text-gray-700">
          <li><strong>「従業員管理」</strong>画面を開き、右側の一覧から対象の従業員をクリックします。</li>
          <li>左側のフォームの「在籍状況」を<strong>「退職済 (非表示)」</strong>に変更し、「更新」を押します。</li>
          <li>これにより、シフト作成画面などから名前が消え、ログインもできなくなります。（集計画面で「退職者も表示する」にチェックを入れると過去のデータは確認可能です）</li>
          <li><span className="text-red-500 font-bold">※注意：</span>一覧の右端にある「削除」を押してしまうと、その人の過去の出勤記録なども完全に消えてしまうため、基本的には「退職済」への変更を利用してください。</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-4 text-indigo-700">4. 年間の業務（年間集計・年収ペースの把握）</h2>
        <ul className="list-decimal pl-6 space-y-2 text-gray-700">
          <li><strong>「年間集計」</strong>画面では、従業員ごとの年間の累計勤務時間や給与を一覧できます。</li>
          <li>「扶養内（103万・130万など）」で働いている従業員について、「このままのペースでいくと上限を超えないかどうか？」をざっくり把握・確認する際に利用します。（※表示される給与は概算であり、実際に支給された額に基づくものではありません）</li>
        </ul>

      </div>
    </div>
  );
}
