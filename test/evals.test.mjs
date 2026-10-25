import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadSuite, runChecks, runSuite } from "../src/evals.mjs";
import { detectLanguage, foreignSentences } from "../src/language.mjs";
import { extractNumbers, untracedNumbers } from "../src/numbers.mjs";

const suite = loadSuite(new URL("../evals/is-guest-replies.json", import.meta.url));
const good = JSON.parse(fs.readFileSync(new URL("../evals/replies-good.json", import.meta.url), "utf8")).replies;
const bad = JSON.parse(fs.readFileSync(new URL("../evals/replies-bad.json", import.meta.url), "utf8")).replies;

test("every case has a good reply and a bad reply", () => {
  for (const c of suite.cases) {
    assert.equal(typeof good[c.id], "string", `no good reply for ${c.id}`);
    assert.ok(bad[c.id]?.fails, `no bad reply for ${c.id}`);
  }
});

for (const c of suite.cases) {
  test(`${c.id}: the good reply passes every check`, () => {
    const failed = runChecks(suite, c, good[c.id]).filter((r) => !r.pass);
    assert.deepEqual(failed, []);
  });
  test(`${c.id}: the bad reply fails on ${bad[c.id].fails}`, () => {
    const results = runChecks(suite, c, bad[c.id].reply);
    const named = results.find((r) => r.check === bad[c.id].fails);
    assert.ok(named, `check ${bad[c.id].fails} did not run: ${results.map((r) => r.check).join(", ")}`);
    assert.equal(named.pass, false, `${bad[c.id].fails} passed a reply it must fail`);
  });
}

test("runSuite counts passed, failed and missing", () => {
  const all = runSuite(suite, good);
  assert.equal(all.scored, suite.cases.length);
  assert.equal(all.passed, suite.cases.length);
  const some = runSuite(suite, { "is-price": bad["is-price"].reply });
  assert.equal(some.scored, 1);
  assert.equal(some.failed[0].id, "is-price");
  assert.equal(some.missing.length, suite.cases.length - 1);
});

test("a suite with a repeated case id is refused", () => {
  const file = new URL("./tmp-dup-suite.json", import.meta.url);
  fs.writeFileSync(file, JSON.stringify({ cases: [{ id: "a", language: "is", message: "x" }, { id: "a", language: "is", message: "y" }] }));
  try {
    assert.throws(() => loadSuite(file), /twice/);
  } finally {
    fs.unlinkSync(file);
  }
});

test("Icelandic without Icelandic letters is Icelandic, not Danish", () => {
  assert.equal(detectLanguage("Hvad kostar herbergid og hvenaer er innritun?").lang, "is");
  assert.equal(detectLanguage("Hvad koster værelset, og hvornår er indtjekning?").lang, "da");
  assert.equal(detectLanguage("How much is the room?").lang, "en");
  assert.equal(detectLanguage("Hvad er").lang, "unknown");
});

test("one foreign sentence in an Icelandic reply is found", () => {
  const found = foreignSentences("Það er laust. Parking is free right outside.", "is");
  assert.equal(found.length, 1);
  assert.equal(found[0].lang, "en");
});

test("Icelandic and English number forms read as the same value", () => {
  const v = (s) => extractNumbers(s).map((n) => n.value);
  assert.deepEqual(v("24.900 kr."), [24900]);
  assert.deepEqual(v("24,900 ISK"), [24900]);
  assert.deepEqual(v("114,5 og 114.5"), [114.5, 114.5]);
  assert.deepEqual(v("kl. 9:30 og 15:00"), ["09:30", "15:00"]);
  assert.deepEqual(v("3. desember"), [3]);
  assert.deepEqual(v("1.250.000 kr."), [1250000]);
  assert.deepEqual(v("sjá example.com/2024 og https://example.com/9"), []);
});

test("untraced numbers: invented ones are named, sourced and small ones pass", () => {
  const facts = "Herbergi kostar 24.900 kr.";
  assert.deepEqual(untracedNumbers("Það kostar 24,900 ISK fyrir 1 nótt.", [facts]), []);
  assert.deepEqual(untracedNumbers("Það kostar 29.900 kr.", [facts]).map((n) => n.raw), ["29.900"]);
  assert.deepEqual(untracedNumbers("Fyrir 2 gesti.", [facts], { allow: [2] }), []);
});
