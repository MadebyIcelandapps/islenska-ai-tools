import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadRules, checkStyle } from "../src/style.mjs";

const rules = loadRules("is");
const evidence = JSON.parse(fs.readFileSync(new URL("../rules/evidence.json", import.meta.url), "utf8")).rules;
const dropped = JSON.parse(fs.readFileSync(new URL("../rules/dropped.json", import.meta.url), "utf8")).dropped;
const GROUPS = ["house", "coinage", "calque", "stiff", "contraction", "grammar", "jargon", "ad-speak"];

test("the Icelandic list is extensive: at least 150 rules in the eight groups", () => {
  assert.ok(rules.length >= 150, `only ${rules.length} rules`);
  for (const g of GROUPS) assert.ok(rules.some((r) => r.group === g), `no rule in group ${g}`);
  for (const r of rules) assert.ok(GROUPS.includes(r.group), `${r.id}: unknown group ${r.group}`);
});

for (const r of rules) {
  test(`${r.id}: says why, what to say instead, where it came from and what backs it`, () => {
    assert.ok(r.why.length >= 20, "why is too short");
    assert.ok(r.suggest, "no natural alternative");
    assert.ok(["native", "house", "grammar"].includes(r.basis), `basis ${r.basis}`);
    assert.ok(["owner", "ours", "ai"].includes(r.origin), `origin ${r.origin}`);
    assert.equal(r.lang, "is");
  });
  if (r.basis === "native") {
    test(`${r.id}: recent native Icelandic backs it (natural form at least twice as common since 2018)`, () => {
      const e = evidence[r.id];
      assert.ok(e, "no counts: run node scripts/native-evidence.mjs");
      assert.equal(e.flaggedQuery, r.evidence.flagged, "the flagged query changed since the counts were taken");
      assert.equal(e.naturalQuery, r.evidence.natural, "the natural query changed since the counts were taken");
      assert.ok(e.natural.recent >= 10, `natural form only ${e.natural.recent} times since 2018`);
      assert.ok(e.natural.recent >= 2 * e.flagged.recent, `flagged ${e.flagged.recent} vs natural ${e.natural.recent} since 2018`);
    });
  }
}

test("no rule the corpus contradicted is back in the list", () => {
  const active = new Set(rules.map((r) => r.id));
  assert.ok(dropped.length > 0);
  for (const d of dropped) assert.ok(!active.has(d.id), `${d.id} was dropped for lack of evidence`);
});

test("lang auto keeps Icelandic rules off English lines and on Icelandic ones", () => {
  const text = "Book online now and get support by email.\nBókaðu online og hafðu samband við support.";
  const hits = checkStyle(text, { rules, scope: "product", lang: "auto" });
  assert.ok(hits.length >= 2);
  assert.ok(hits.every((h) => h.line === 2), JSON.stringify(hits.map((h) => [h.line, h.rule])));
  assert.ok(checkStyle(text, { rules, scope: "product" }).some((h) => h.line === 1), "without lang every rule runs on every line");
});

test("lang auto still reads a short Icelandic line that has only accented vowels", () => {
  assert.ok(checkStyle("Er sókn innifalin?", { rules, scope: "product", lang: "auto" }).some((h) => h.rule === "sokn-pickup"));
  assert.deepEqual(checkStyle("Pickup from the hotel is included in the price of the tour.", { rules, scope: "product", lang: "auto" }), []);
  assert.deepEqual(checkStyle("Ayer hablé con Anna en la oficina y ya me lo confirmó ella.", { rules, scope: "product", lang: "auto" }), []);
});

test("a modern loan Icelanders really use is allowed: email, okei, takk, app", () => {
  const ok = "Sendu okkur email. Okei, takk! Sæktu appið.";
  assert.deepEqual(checkStyle(ok, { rules, scope: "product" }).map((h) => h.rule), []);
});
