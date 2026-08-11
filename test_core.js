/* 无痛英语 EnglishLite — 核心逻辑单元测试（node test_core.js） */
"use strict";
const assert = require("assert");
const core = require("./core.js");
const bank = require("./words.js");

const matcher = core.makeMatcher(bank);

/* 1. 词边界：允许汉字相邻（连续汉字流也能匹配），靠长词优先防拆词 */
const plan1 = matcher("今天天气很好");
assert.strictEqual(plan1.length, 2, "「今天天气很好」应匹配「今天」「天气」（相邻不重叠）");
assert.strictEqual(plan1[0].zh, "今天");
assert.strictEqual(plan1[1].zh, "天气");
assert.deepStrictEqual(matcher("大家好"), [
  { start: 0, end: 3, zh: "大家好", en: "Hello everyone" }
], "「大家好」整词优先于「大家」");
assert.deepStrictEqual(matcher("我很好啊"), [
  { start: 0, end: 3, zh: "我很好", en: "I'm fine" }
], "「我很好」后接汉字也允许");
assert.deepStrictEqual(matcher("但是我很忙"), [
  { start: 0, end: 2, zh: "但是", en: "but" }
], "「但是」后接汉字也允许");
/* URL/英文/数字相邻不替换 */
assert.deepStrictEqual(matcher("abc天气"), [], "英文紧邻不替换");
assert.deepStrictEqual(matcher("123时间"), [], "数字紧邻不替换");

/* 2. 短句整句匹配 */
assert.deepStrictEqual(matcher("你好吗？"), [
  { start: 0, end: 3, zh: "你好吗", en: "How are you" }
], "「你好吗」应整句匹配，而非拆成「你好」");

assert.deepStrictEqual(matcher("我很高兴认识你"), [
  { start: 1, end: 7, zh: "很高兴认识你", en: "Nice to meet you" }
], "4字以上短句允许前接汉字");

/* 3. 应用替换：保留原文标点（全角问号不被动） */
assert.strictEqual(core.applyPlan("你好吗？", matcher("你好吗？")), "How are you？");

/* 4. 多候选 + 全量替换 */
const sentence = "你好，我叫小明，很高兴认识你，请多多关照。";
const all = core.chooseByProbability(matcher(sentence), 1);
const out = core.applyPlan(sentence, all);
console.log("  全量替换演示:", out);
assert.ok(out.includes("Hello"), "应替换出 Hello");
assert.ok(out.includes("Nice to meet you"), "应替换出短句");

/* 5. 概率边界 */
assert.deepStrictEqual(core.chooseByProbability(matcher("你好吗？"), 0), [], "概率 0 应不替换");

/* 6. 重复出现：同一文本多次匹配 */
assert.strictEqual(matcher("你好，你好，你好").length, 3, "重复词应全部找到");

/* 7. 空文本 / 无中文 */
assert.deepStrictEqual(matcher("hello world 123"), [], "纯英文不应匹配");
assert.deepStrictEqual(matcher(""), [], "空串不应匹配");

/* 8. 词库自身：无重复中文词条、条数合理 */
const zhs = bank.map(b => b.zh);
assert.strictEqual(new Set(zhs).size, zhs.length, "词库中不应有重复中文词条");
console.log("  词库词条数:", bank.length);

/* 9. 性能：大词库 + 长文本的匹配耗时（首字索引优化后应 < 200ms） */
const longText = ("今天天气很好，我和朋友一起去学校学习，老师布置了很多作业。" +
  "这个问题非常重要，我们需要认真考虑，选择最好的解决方案。").repeat(50);
const t0 = Date.now();
const planLong = matcher(longText);
const cost = Date.now() - t0;
console.log("  长文本(" + longText.length + "字)匹配:", planLong.length, "个候选,", cost + "ms");
assert.ok(cost < 200, "长文本匹配耗时 " + cost + "ms 应 < 200ms");

console.log("\n✓ 全部测试通过");
