/*
  ファイル名 : sw.js
  保存場所   : / （index.html と同じ場所）
  役割       : サービスワーカー。
                 1. 通信できるとき … GitHub の最新版を必ず使う（古いファイルが使われ続ける問題を防ぐ）
                 2. 通信できないとき … スマホに保存しておいた分で動かす（オフラインでも遊べる）
  バージョン : 2.1.0（Phase18：みんなで対戦のファイルを追加。保存場所を作り直す）

  しくみ
    ・このサイト自身のファイル（html / css / js / 画像）
        → まず GitHub に最新版を確認し、取れたらスマホにも保存しておく。
          通信できない・遅すぎるときは保存しておいた分を使う
    ・Three.js（jsdelivr）とフォント（Google Fonts）
        → 版が変わらないので、一度保存したら保存した分を使う（通信しない分、起動が速い）
    ・最初に開いたとき、ゲームに必要なファイルをまとめて保存しておく
  メモ       : 保存場所の名前（CACHE_NAME）を変えると、古い保存分はすべて消えて作り直される
*/

const CACHE_NAME = 'sky-racer-v2-4';

// 通信が遅いときに、保存分に切り替えるまでの秒数（保存分がないときは通信を待ち続ける）
const NETWORK_TIMEOUT = 4;

// 版が変わらない別サイトのファイル（保存した分をずっと使う）
const FIXED_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

// 最初にまとめて保存しておくファイル
const PRECACHE = [
  './',
  'index.html',
  'manifest.json',
  'css/style.css',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'js/main.js',
  'js/config.js',
  'js/ai/AIController.js',
  'js/art/Parts.js',
  'js/art/PixelArt.js',
  'js/audio/AudioManager.js',
  'js/audio/Music.js',
  'js/audio/Sfx.js',
  'js/core/Debug.js',
  'js/core/Game.js',
  'js/core/Input.js',
  'js/core/Loop.js',
  'js/core/Quality.js',
  'js/core/Screens.js',
  'js/courses/Courses.js',
  'js/courses/desert.js',
  'js/courses/desertData.js',
  'js/courses/harbor.js',
  'js/courses/harborData.js',
  'js/courses/ice.js',
  'js/courses/iceData.js',
  'js/courses/mushroom.js',
  'js/courses/mushroomData.js',
  'js/courses/observatory.js',
  'js/courses/observatoryData.js',
  'js/courses/volcano.js',
  'js/courses/volcanoData.js',
  'js/entities/Characters.js',
  'js/entities/Racer.js',
  'js/entities/RacerSprite.js',
  'js/net/Link.js',
  'js/net/NetRace.js',
  'js/net/Room.js',
  'js/net/Secure.js',
  'js/net/Signal.js',
  'js/render/Atmosphere.js',
  'js/render/CameraRig.js',
  'js/render/Effects.js',
  'js/render/PostFX.js',
  'js/systems/Collision.js',
  'js/systems/RaceManager.js',
  'js/systems/GrandPrix.js',
  'js/systems/RaceSession.js',
  'js/systems/Records.js',
  'js/ui/CharacterSelect.js',
  'js/ui/CourseSelect.js',
  'js/ui/GrandPrixResult.js',
  'js/ui/HUD.js',
  'js/ui/Lobby.js',
  'js/ui/Menu.js',
  'js/ui/Title.js',
  'js/world/Buildings.js',
  'js/world/CourseBuilder.js',
  'js/world/CourseData.js',
  'js/world/Decor.js',
  'js/world/Environment.js',
  'js/world/Landmarks.js',
  'js/world/Rings.js',
  'js/world/Theme.js',
  'js/world/Track.js',
  'js/world/World.js',
  'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js',
  'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.core.js'
];

self.addEventListener('install', (event) => {
  // 1つ取れなくても他は保存する（全部そろわなくても、遊びながら残りが保存されていく）
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(PRECACHE.map((path) =>
        fetch(new Request(path, { cache: 'no-cache' })).then((res) => {
          if (res.ok) return cache.put(path, res);
          return null;
        })
      ))
    ).then(() => self.skipWaiting())   // 新しい版をすぐ使えるようにする
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // 名前の違う古い保存分を消す
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())   // 開いているページもすぐこの仕組みの対象にする
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else if (FIXED_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
  }
  // それ以外の別サイトは、この仕組みを通さない
});

// ---- このサイトのファイル：最新版を優先、だめなら保存分 ----
function networkFirst(request) {
  return caches.open(CACHE_NAME).then((cache) => {
    const fromNetwork = fetch(request, { cache: 'no-cache' }).then((res) => {
      if (res.ok) {
        // 保存は裏で行う（表示を待たせない）
        cache.put(request, res.clone()).catch(() => {});
      }
      return res;
    });

    return cache.match(request, { ignoreSearch: true }).then((cached) => {
      if (!cached) {
        // 保存分がないときは通信を待つ。ページを開くときだけ、トップページの保存分も試す
        return fromNetwork.catch(() => {
          if (request.mode === 'navigate') {
            return cache.match('./').then((top) => top || cache.match('index.html')).then((page) => page || Response.error());
          }
          return Response.error();
        });
      }
      // 保存分があるときは、通信が失敗するか遅すぎたら保存分を使う
      return new Promise((resolve) => {
        let done = false;
        const timer = setTimeout(() => {
          if (!done) { done = true; resolve(cached); }
        }, NETWORK_TIMEOUT * 1000);
        fromNetwork.then((res) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(res.ok ? res : cached);
        }).catch(() => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(cached);
        });
      });
    });
  });
}

// ---- 版が変わらないファイル：保存分を優先、なければ取って保存 ----
function cacheFirst(request) {
  return caches.open(CACHE_NAME).then((cache) =>
    cache.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        // フォントの見た目の指定（opaque）も保存してよい
        if (res.ok || res.type === 'opaque') cache.put(request, res.clone()).catch(() => {});
        return res;
      });
    })
  );
}
