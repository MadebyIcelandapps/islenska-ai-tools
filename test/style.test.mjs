import { test } from "node:test";
import assert from "node:assert/strict";
import { checkStyle, rewriteStyle, loadRules, compileRule } from "../src/style.mjs";

// Every rule proves itself: its bad examples hit it, its good examples hit nothing.
for (const lang of ["is", "en"]) {
  const rules = loadRules(lang);
  for (const rule of rules) {
    test(`${lang}/${rule.id}: has a reason and examples both ways`, () => {
      assert.ok(rule.why.length > 20);
      assert.ok(rule.examples?.bad?.length, "needs a bad example");
      assert.ok(rule.examples?.good?.length, "needs a good example");
    });
    for (const bad of rule.examples?.bad ?? []) {
      test(`${lang}/${rule.id} catches: ${bad}`, () => {
        const hits = checkStyle(bad, { rules, scope: "product" }).filter((h) => h.rule === rule.id);
        assert.ok(hits.length > 0, `no hit for ${bad}`);
      });
    }
    for (const good of rule.examples?.good ?? []) {
      test(`${lang}/${rule.id} allows: ${good}`, () => {
        assert.deepEqual(checkStyle(good, { rules, scope: "product" }), []);
      });
    }
  }
}

test("product rules only run in product scope", () => {
  const text = "Móttaka fyrir lítil fyrirtæki.";
  assert.deepEqual(checkStyle(text), []);
  assert.equal(checkStyle(text, { scope: "product" })[0].rule, "litil");
});

test("the allow marker keeps the AI notice line and nothing else", () => {
  const text = "Þetta er gervigreind. [ai-disclosure]\nGervigreindarmóttaka fyrir þig.";
  const hits = checkStyle(text, { scope: "product" });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, 2);
});

test("addresses are never flagged", () => {
  assert.deepEqual(checkStyle("Sjá https://example.com/smíði og smíði@example.com", { scope: "product" }), []);
});

test("HTML is read as a visitor sees it", () => {
  const html = '<style>.smíði{}</style><p class="skrunaðu">Gert á Íslandi</p><!-- smíðað -->';
  assert.deepEqual(checkStyle(html, { fileName: "x.html", scope: "product" }), []);
  assert.equal(checkStyle("<p>Smíðað á Íslandi</p>", { fileName: "x.html" })[0].rule, "smid");
});

test("hits carry line, column and a reason", () => {
  const [hit] = checkStyle("Halló.\nVerð: 24.900 kr án vsk.");
  assert.equal(hit.rule, "vsk");
  assert.equal(hit.line, 2);
  assert.equal(hit.column, 20);
  assert.match(hit.why, /price/);
});

test("rewriteStyle swaps words, keeps capitals and leaves the rest byte for byte", () => {
  assert.equal(rewriteStyle("Skrunaðu niður. Þetta er smíðað hér."), "Sjáðu neðar. Þetta er gert hér.");
  assert.equal(rewriteStyle("SMÍÐAÐ"), "GERT");
  assert.equal(rewriteStyle("Ekkert að laga hér.\n  Bil  haldast."), "Ekkert að laga hér.\n  Bil  haldast.");
  assert.equal(rewriteStyle("Sjá example.com/smíði"), "Sjá example.com/smíði");
});

test("a bad rule file is refused with a reason", () => {
  assert.throws(() => loadRules({ rules: [{ id: "x", pattern: "y" }] }), /needs id, why and pattern/);
  assert.throws(() => loadRules({ rules: [{ id: "x", why: "y", pattern: "z", scope: "web" }] }), /scope/);
});

test("{LB} and {RB} edges work on Icelandic letters where \\b fails", () => {
  const re = compileRule({ id: "t", why: "t", pattern: "{LB}það{RB}" });
  assert.equal("Það er gott.".match(re)?.length, 1);
  assert.equal("Þaðan".match(re), null);
  assert.equal(/\bþað\b/iu.test("Það er gott."), false, "the \\b trap this helper exists for");
});
