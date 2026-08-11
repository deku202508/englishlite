/* 无痛英语 EnglishLite — popup 逻辑
 * 统一使用 chrome.storage.local：本地存储，不依赖 Google 账号同步（国内网络下更可靠） */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var DEFAULTS = { enabled: true, intensity: 0.2, hoverHint: true };
  var store = chrome.storage.local;

  store.get(DEFAULTS, function (s) {
    $("enabled").checked = s.enabled;
    $("hoverHint").checked = s.hoverHint;
    var pct = Math.round(s.intensity * 100);
    $("intensity").value = pct;
    $("intensityVal").textContent = pct + "%";
  });

  $("enabled").addEventListener("change", function (e) {
    store.set({ enabled: e.target.checked });
  });

  $("hoverHint").addEventListener("change", function (e) {
    store.set({ hoverHint: e.target.checked });
  });

  $("intensity").addEventListener("input", function (e) {
    var v = Number(e.target.value);
    $("intensityVal").textContent = v + "%";
    store.set({ intensity: v / 100 });
  });

  /* 词条数：直接读词库（words.js 已在 popup.html 加载） */
  $("count").textContent = (window.WORD_BANK ? window.WORD_BANK.length : 200) + "+";
})();
