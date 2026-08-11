/* 无痛英语 EnglishLite — 核心匹配逻辑（纯函数，可在 node 中测试）
 * UMD：浏览器里挂 window.ESWCore，node 里 require */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ESWCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var CJK_RE = /[\u4e00-\u9fa5]/;
  function isCJK(ch) { return !!ch && CJK_RE.test(ch); }

  /* 词边界检查：
   *   两端不能紧邻 ASCII 字母/数字（避免破坏 URL/英文/数字串）
   *   允许紧邻汉字 —— 中文无分词，真实网页是连续汉字流，
   *   过严的边界（原「前后都不能是汉字」）会让正文几乎无法匹配；
   *   防拆词改由「长词优先 + 去重叠」承担 */
  function boundaryOk(text, start, end) {
    var before = text[start - 1];
    var after = text[end];
    if (before && /[A-Za-z0-9]/.test(before)) return false;
    if (after && /[A-Za-z0-9]/.test(after)) return false;
    return true;
  }

  /* 根据词库生成匹配器。词条按首字建索引（只查文本中出现的汉字），每组内按长度降序（长词优先） */
  function makeMatcher(bank) {
    var index = new Map();
    for (var i = 0; i < bank.length; i++) {
      var item = bank[i];
      var ch = item.zh[0];
      var list = index.get(ch);
      if (!list) { list = []; index.set(ch, list); }
      list.push(item);
    }
    index.forEach(function (list) { list.sort(function (a, b) { return b.zh.length - a.zh.length; }); });

    return function findCandidates(text) {
      if (!text || !CJK_RE.test(text)) return [];
      /* 提取文本中出现的汉字集合 */
      var chars = new Set();
      for (var i = 0; i < text.length; i++) {
        var ch = text.charAt(i);
        if (CJK_RE.test(ch)) chars.add(ch);
      }
      var out = [];
      chars.forEach(function (ch) {
        var list = index.get(ch);
        if (!list) return;
        for (var k = 0; k < list.length; k++) {
          var item = list[k];
          var zh = item.zh;
          var idx = 0;
          while ((idx = text.indexOf(zh, idx)) !== -1) {
            if (boundaryOk(text, idx, idx + zh.length)) {
              out.push({ start: idx, end: idx + zh.length, zh: zh, en: item.en });
            }
            idx += zh.length;
          }
        }
      });
      /* 去重叠：按起点排序，同起点长优先，贪心保留不重叠区间 */
      out.sort(function (a, b) { return a.start - b.start || (b.end - b.start) - (a.end - a.start); });
      var kept = [];
      var lastEnd = -1;
      for (var j = 0; j < out.length; j++) {
        if (out[j].start >= lastEnd) { kept.push(out[j]); lastEnd = out[j].end; }
      }
      return kept;
    };
  }

  /* 按概率随机挑选替换点 */
  function chooseByProbability(plan, p) {
    return plan.filter(function () { return Math.random() < p; });
  }

  /* 按替换计划重建文本（纯文本版，用于测试 / 预览） */
  function applyPlan(text, plan) {
    var out = "";
    var last = 0;
    for (var i = 0; i < plan.length; i++) {
      out += text.slice(last, plan[i].start) + plan[i].en;
      last = plan[i].end;
    }
    return out + text.slice(last);
  }

  return { makeMatcher: makeMatcher, chooseByProbability: chooseByProbability, applyPlan: applyPlan, isCJK: isCJK, boundaryOk: boundaryOk };
});
