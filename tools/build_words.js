/* 构建词库：人工词库 + 四级词表(CET4_T) → words.js
 * 运行：node tools/build_words.js
 * 源数据：tools/data/cet4_raw.json（qwerty-learner，需先下载） */
"use strict";
const fs = require("fs");
const path = require("path");

const cet4 = require("./data/cet4_raw.json");
const existing = require("../words.js");

/* 词性前缀：v. n. adj. adv. vt. vi. prep. conj. pron. num. art. aux. 等 */
const PREFIX_RE = /^(?:[a-z]+\.\s*)+/i;
const BAD_CHARS = /[…~_%]/;
/* 被动/使役结构开头，替换后不自然 */
const BAD_START = /^[被使将把让]/;

function cleanZh(s) {
  let t = s.replace(/[（(][^）)]*[)）]/g, ""); /* 去括号说明 */
  t = t.replace(/\s+/g, "").replace(/[，,；;、]/g, ""); /* 去空格与分隔符 */
  return t;
}

/* 固定补充：高频组合词，靠长词优先防止拆词（如「大家好」优先于「大家」） */
const FIXED = [
  { zh: "大家好", en: "Hello everyone" },
  { zh: "同学们", en: "classmates" },
  { zh: "朋友们", en: "friends" },
  { zh: "老师们", en: "teachers" },
];

const newEntries = [];
const seen = new Set(existing.concat(FIXED).map((e) => e.zh));

for (const item of cet4) {
  const en = item.name;
  if (!en || !(item.trans || []).length) continue;
  for (const t of item.trans) {
    const noPrefix = t.replace(PREFIX_RE, "");
    const parts = noPrefix.split(/[；;，,、]/);
    for (const part of parts) {
      const zh = cleanZh(part);
      if (!/^[\u4e00-\u9fff]{2,6}$/.test(zh)) continue; /* 只留纯 2~6 汉字 */
      if (BAD_CHARS.test(part)) continue;
      if (BAD_START.test(zh)) continue;
      if (seen.has(zh)) continue;
      seen.add(zh);
      newEntries.push({ zh, en });
    }
  }
}

/* 单字词黑名单：与相邻汉字易组成常见词（帮忙/积累/创新/快乐…），替换会拆词 */
const BAD_SINGLE = new Set(["忙", "累", "新", "贵", "快", "慢", "旧"]);

/* 合并 + 统一去重（Map 按 zh 去重，防止 FIXED 与已有词条重复） */
const allMap = new Map();
for (const e of existing.concat(FIXED, newEntries)) {
  if (e.zh.length === 1 && BAD_SINGLE.has(e.zh)) continue;
  allMap.set(e.zh, e);
}
const all = Array.from(allMap.values());
all.sort((a, b) => a.zh.localeCompare(b.zh, "zh"));

const lines = all.map((e) => `    { zh: ${JSON.stringify(e.zh)}, en: ${JSON.stringify(e.en)} },`);
const out =
`/* 无痛英语 EnglishLite — 内置词库
 * 人工精选常用词/短句 + 四级词汇表（来源 qwerty-learner CET4_T，中文释义自动清洗）
 * UMD：浏览器里挂 window.WORD_BANK，node 里 module.exports */
(function (root) {
  var BANK = [
${lines.join("\n")}
  ];

  if (typeof module !== "undefined" && module.exports) module.exports = BANK;
  if (root) root.WORD_BANK = BANK;
})(typeof self !== "undefined" ? self : this);
`;

fs.writeFileSync(path.join(__dirname, "..", "words.js"), out);
console.log("原有:", existing.length, "新增:", newEntries.length, "合计:", all.length);
