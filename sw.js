// アプリの画面(HTML/CSS/JS)を端末に保存して、通信が弱くても開けるようにします。
// 更新したときは、下の CACHE の数字を 1 つ上げてください。
var CACHE = 'tacica-lyrics-v1';
var ASSETS = [
  './', './index.html', './style.css', './app.js', './songs.js', './lyrics.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

// 自分のサイトのファイルだけを対象にする(YouTubeなどは触らない)
// ネットワーク優先、だめなら保存したものを使う
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(function (r) {
      var copy = r.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return r;
    }).catch(function () { return caches.match(e.request); })
  );
});
