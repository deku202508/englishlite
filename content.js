/* 无痛英语 EnglishLite — 页面注入脚本
 * 遍历文本节点 → 随机替换词库中的中文 → 悬停显示中文释义 */
(function () {
  "use strict";

  var BANK = (typeof window !== "undefined" && window.WORD_BANK) || [];
  var core = (typeof window !== "undefined" && window.ESWCore) || null;
  if (!core || !BANK.length) {
    if (typeof console !== "undefined") console.warn("[EnglishLite] 词库或核心模块未加载，插件未生效", { core: !!core, words: BANK.length });
    return;
  }

  var findCandidates = core.makeMatcher(BANK);
  var DEFAULTS = { enabled: true, intensity: 0.2, hoverHint: true };
  var SKIP_SELECTOR = "script,style,textarea,input,select,option,noscript,pre,code,kbd,samp,var,title";

  var settings = Object.assign({}, DEFAULTS);
  var processed = new WeakSet(); // 已处理过的文本节点（含替换后剩余的中文片段，避免重复处理）

  function shouldSkip(parent) {
    if (!parent) return true;
    try {
      if (parent.closest(SKIP_SELECTOR + ",.esw-replaced")) return true;
    } catch (e) { /* 忽略异常 */ }
    return false;
  }

  function processTextNode(node) {
    if (processed.has(node)) return;
    var text = node.nodeValue;
    if (!text || !text.trim() || !/[\u4e00-\u9fa5]/.test(text)) { processed.add(node); return; }
    if (shouldSkip(node.parentNode)) { processed.add(node); return; }

    var plan = core.chooseByProbability(findCandidates(text), settings.intensity);
    if (!plan.length) { processed.add(node); return; }

    var frag = document.createDocumentFragment();
    var last = 0;
    for (var i = 0; i < plan.length; i++) {
      var c = plan[i];
      if (c.start > last) frag.appendChild(document.createTextNode(text.slice(last, c.start)));
      var span = document.createElement("span");
      span.textContent = c.en;
      span.className = "esw-replaced";
      span.setAttribute("data-zh", c.zh); /* 始终存原文，供恢复使用（hover 提示可关） */
      if (settings.hoverHint) span.title = c.zh;
      frag.appendChild(span);
      last = c.end;
    }
    if (last < text.length) {
      var tail = document.createTextNode(text.slice(last));
      processed.add(tail); // 剩余中文不再被本轮/后续 observer 处理
      frag.appendChild(tail);
    }
    node.parentNode.replaceChild(frag, node);
  }

  function walk(root) {
    /* 先收集再处理：遍历过程中 replaceChild 会让 TreeWalker 游标失效，跳过后续节点 */
    var nodes = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (processed.has(n)) return NodeFilter.FILTER_REJECT;
        return shouldSkip(n.parentNode) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = walker.nextNode())) nodes.push(n);
    for (var i = 0; i < nodes.length; i++) processTextNode(nodes[i]);
  }

  /* 把所有已替换的 span 恢复成中文原文（data-zh 始终存在，title 可能因悬停提示关闭而缺失） */
  function restoreAll() {
    var spans = document.querySelectorAll("span.esw-replaced");
    for (var i = 0; i < spans.length; i++) {
      var span = spans[i];
      if (!span.parentNode) continue;
      var zh = span.getAttribute("data-zh") || span.getAttribute("title");
      if (!zh) continue;
      span.parentNode.replaceChild(document.createTextNode(zh), span);
    }
  }

  /* 动态内容（SPA / 懒加载） */
  var observer = new MutationObserver(function (muts) {
    if (!settings.enabled) return;
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      if (m.type !== "childList") continue;
      var nodes = m.addedNodes;
      for (var j = 0; j < nodes.length; j++) {
        var n = nodes[j];
        if (n.nodeType === Node.TEXT_NODE) processTextNode(n);
        else if (n.nodeType === Node.ELEMENT_NODE) walk(n);
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  /* 初始扫描：立即执行，不等 storage。
     之前用 chrome.storage.sync.get 初始化，国内网络下可能长时间无回调 → 插件完全不生效。
     现在先用默认设置立刻替换，storage 读回后若与默认不同则重扫应用用户设置。 */
  if (settings.enabled) walk(document.body || document.documentElement);

  try {
    chrome.storage.local.get(DEFAULTS, function (s) {
      var merged = Object.assign({}, DEFAULTS, s);
      var changed = merged.enabled !== settings.enabled ||
                    merged.intensity !== settings.intensity ||
                    merged.hoverHint !== settings.hoverHint;
      settings = merged;
      if (settings.enabled && changed) {
        processed = new WeakSet(); /* 重扫，让用户设置的强度生效 */
        walk(document.body || document.documentElement);
      }
    });
  } catch (e) { /* storage 不可用时不阻塞，插件仍按默认设置工作 */ }

  /* popup 改设置 → 即时生效。
     强度/开关变化：先把已替换的 span 全部恢复成原文，再按新设置重扫 ——
     这样调高实时变多、调低实时变少、关闭立即恢复。防抖避免滑块拖动时频繁全量重建。 */
  var rescanTimer = null;
  function scheduleRescan() {
    clearTimeout(rescanTimer);
    rescanTimer = setTimeout(function () {
      restoreAll();
      processed = new WeakSet();
      if (settings.enabled) walk(document.body || document.documentElement);
    }, 120);
  }

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local") return;
    if (changes.enabled) settings.enabled = changes.enabled.newValue;
    if (changes.intensity) settings.intensity = changes.intensity.newValue;
    if (changes.hoverHint) settings.hoverHint = changes.hoverHint.newValue;
    if (changes.enabled !== undefined || changes.intensity !== undefined) {
      scheduleRescan();
    }
  });
})();
