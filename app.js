(function () {
  var $ = function (s) { return document.querySelector(s); };
  var lyricsEl = $('#lyrics'), bgEl = $('#bg'), statusEl = $('#status');
  var listEl = $('#songList'), titleEl = $('#songTitle'), menuEl = $('#menu');

  var player = null;
  var ready = false;
  var pendingId = null;
  var current = null;
  var lines = [], els = [], activeIdx = -1;
  var pendingJump = true;
  var apiProblem = '';   // YouTubeのプレーヤーに問題があるとき、理由を入れる

  // ---- 曲の一覧(songs.js + この端末で追加したもの) ----
  var extras = [];
  try { extras = JSON.parse(localStorage.getItem('extraSongs') || '[]'); } catch (e) { extras = []; }

  function allSongs() {
    var seen = {}, out = [];
    (window.SONGS || []).concat(extras).forEach(function (s) {
      if (s && s.id && !seen[s.id]) { seen[s.id] = true; out.push(s); }
    });
    return out;
  }

  function saveExtras() {
    try { localStorage.setItem('extraSongs', JSON.stringify(extras)); } catch (e) {}
  }

  function renderList() {
    listEl.innerHTML = '';
    var songs = allSongs();
    if (songs.length === 0) {
      var p = document.createElement('div');
      p.className = 'empty';
      p.textContent = 'まだ曲がありません。下の欄に、YouTubeの動画URLを貼って追加してください。';
      listEl.appendChild(p);
      return;
    }
    songs.forEach(function (s) {
      var b = document.createElement('button');
      b.textContent = s.title || s.id;
      b.addEventListener('click', function () { select(s); menuEl.open = false; });
      listEl.appendChild(b);
    });
  }

  // ---- URLから動画IDを取り出す ----
  function parseId(text) {
    var m = String(text).match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
    if (m) return m[1];
    if (/^[\w-]{11}$/.test(text.trim())) return text.trim();
    return null;
  }

  $('#addBtn').addEventListener('click', function () {
    var input = $('#urlInput');
    var id = parseId(input.value);
    if (!id) { statusEl.textContent = '動画IDを読み取れませんでした。URLを確認してください。'; return; }
    var song = { id: id, title: '(読み込み中…)' };
    extras.push(song);
    saveExtras();
    input.value = '';
    renderList();
    select(song);
    menuEl.open = false;
  });

  // ---- 曲を選ぶ ----
  function select(song) {
    current = song;
    titleEl.textContent = song.title || song.id;
    statusEl.textContent = apiProblem || '再生ボタンを押すと、歌詞が動きます。';
    bgEl.style.backgroundImage = 'url(https://i.ytimg.com/vi/' + song.id + '/hqdefault.jpg)';
    build((window.LYRICS || {})[song.id] || window.DEMO_LINES);
    if (player && ready) {
      player.loadVideoById(song.id);
    } else {
      pendingId = song.id;
    }
  }

  // ---- 歌詞の行を作る ----
  function build(newLines) {
    lines = newLines;
    lyricsEl.innerHTML = '';
    activeIdx = -1;
    pendingJump = true;
    els = lines.map(function (l) {
      var d = document.createElement('div');
      d.className = 'line';
      d.textContent = l.text;
      lyricsEl.appendChild(d);
      return d;
    });
    updatePadding();
  }

  // 最初と最後の行も真ん中に来られるように、上下に余白を作る
  function updatePadding() {
    var half = Math.floor(lyricsEl.clientHeight / 2);
    lyricsEl.style.paddingTop = half + 'px';
    lyricsEl.style.paddingBottom = half + 'px';
  }
  window.addEventListener('resize', updatePadding);

  // ---- YouTube埋め込みプレーヤー ----
  window.onYouTubeIframeAPIReady = function () {
    try {
    player = new YT.Player('player', {
      width: '100%',
      height: '100%',
      videoId: pendingId || undefined,
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady: function () {
          ready = true;
          apiProblem = '';
          if (pendingId) player.cueVideoById(pendingId);
        },
        onStateChange: onState,
        onError: onError
      }
    });
    } catch (err) {
      apiProblem = 'プレーヤーを作れませんでした: ' + err.message;
      statusEl.textContent = apiProblem;
    }
  };

  var tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  tag.onerror = function () {
    apiProblem = 'YouTubeのプレーヤーを読み込めませんでした(ブロックされている可能性があります)。';
    statusEl.textContent = apiProblem;
  };
  document.head.appendChild(tag);
  setTimeout(function () {
    if (!ready && !apiProblem) {
      apiProblem = 'YouTubeのプレーヤーを読み込めていません。広告ブロックの拡張機能や、通信の制限が原因かもしれません。別のブラウザでも試してください。';
      statusEl.textContent = apiProblem;
    }
  }, 8000);

  function onState(e) {
    // 動画のタイトルが分かったら、曲名として保存する
    if (current && e.data !== -1 && /^\(/.test(current.title || '')) {
      try {
        var t = player.getVideoData().title;
        if (t) {
          current.title = t;
          titleEl.textContent = t;
          saveExtras();
          renderList();
        }
      } catch (err) {}
    }
    if (e.data === 1) { statusEl.textContent = ''; requestWake(); } else { releaseWake(); }
  }

  function onError(e) {
    var code = e.data;
    if (code === 101 || code === 150) {
      statusEl.textContent = 'この動画は、埋め込みでの再生が許可されていません。別の動画を試してください。';
    } else if (code === 100) {
      statusEl.textContent = '動画が見つかりません(非公開か削除された可能性があります)。';
    } else {
      statusEl.textContent = '再生でエラーが出ました(コード ' + code + ')。';
    }
  }

  // ---- 再生時間に合わせて歌詞をスクロール ----
  function scrollToActive(smooth) {
    var el = els[activeIdx];
    if (!el) return;
    var target = el.offsetTop + el.offsetHeight / 2 - lyricsEl.clientHeight / 2;
    lyricsEl.scrollTo({ top: target, behavior: smooth ? 'smooth' : 'auto' });
  }

  setInterval(function () {
    if (!ready || !current || lines.length === 0) return;
    var posMs;
    try { posMs = player.getCurrentTime() * 1000; } catch (e) { return; }
    if (!isFinite(posMs)) return;

    var idx = -1;
    for (var i = 0; i < lines.length; i++) if (lines[i].t <= posMs) idx = i;
    if (idx >= 0 && idx !== activeIdx) {
      if (els[activeIdx]) els[activeIdx].classList.remove('active');
      els[idx].classList.add('active');
      activeIdx = idx;
      scrollToActive(!pendingJump);
      pendingJump = false;
    }
  }, 200);

  // ---- 再生中は画面を暗くしない(対応している端末のみ) ----
  var wake = null;
  function requestWake() {
    if (!('wakeLock' in navigator) || wake) return;
    navigator.wakeLock.request('screen').then(function (w) {
      wake = w;
      w.addEventListener('release', function () { wake = null; });
    }).catch(function () {});
  }
  function releaseWake() {
    if (wake) { wake.release().catch(function () {}); wake = null; }
  }

  renderList();

  // 開いたときに、先頭の曲を自動で選んでおく(再生ボタンが見えるようにするため)
  var first = allSongs()[0];
  if (first) select(first);
})();
