/*
  ファイル名 : sw.js
  保存場所   : / （index.html と同じ場所）
  役割       : サービスワーカー。ゲームのファイルを読み込むたびに
               GitHub に最新版があるか必ず確認させ、古いファイルが
               使われ続ける（キャッシュ）問題を防ぐ
  バージョン : 0.2.3（Phase2 Step2-3）

  しくみ
    ・このサイト自身のファイル（html / css / js）だけを対象にする
    ・毎回「変更があるか」をGitHubに確認する（変更がなければ通信はごく少量）
    ・Three.js（別サイトのCDN）は版が固定なので対象外
    ・通信できないときはブラウザが持っている分で動かす
*/

self.addEventListener('install', () => {
  // 新しい版をすぐ使えるようにする
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // 開いているページもすぐこの仕組みの対象にする
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request, { cache: 'no-cache' }).catch(() => fetch(request))
  );
});
