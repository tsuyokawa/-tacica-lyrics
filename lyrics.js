// 歌詞データの置き場です。今はダミーのみ。本物の歌詞は入れていません。
// 公開するときは、ここを「許諾を得た提供元から取得する処理」に差し替えます。
//
// 形式: 動画ID -> [{ t: ミリ秒, text: "1行" }, ...]  (Android版のLyricsData.ktと同じ形)
window.LYRICS = {
  // "XXXXXXXXXXX": [
  //   { t: 0,     text: "1行目" },
  //   { t: 12000, text: "2行目" },
  // ],
};

// 歌詞が登録されていない動画のためのデモ用(5秒ごとに進む)
window.DEMO_LINES = Array.from({ length: 40 }, function (_, i) {
  return { t: i * 5000, text: "ダミー歌詞 " + (i + 1) + "行目" };
});
