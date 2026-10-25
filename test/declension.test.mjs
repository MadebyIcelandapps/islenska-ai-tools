import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDeclension, fixDeclension, formsOf } from "../src/declension.mjs";

const VAKI = [{ name: "Vaki", pattern: "veikt-kk-i" }];

test("weak masculine in -i: Vaki, Vaka, Vaka, Vaka", () => {
  assert.deepEqual(formsOf({ name: "Vaki", pattern: "veikt-kk-i" }), { nf: "Vaki", þf: "Vaka", þgf: "Vaka", ef: "Vaka" });
  assert.deepEqual(formsOf({ name: "Bragi", pattern: "veikt-kk-i" }), { nf: "Bragi", þf: "Braga", þgf: "Braga", ef: "Braga" });
});

test("weak feminine in -a with u-umlaut: Saga > Sögu, Anna > Önnu", () => {
  assert.equal(formsOf({ name: "Sunna", pattern: "veikt-kvk-a" }).þgf, "Sunnu");
  assert.equal(formsOf({ name: "Saga", pattern: "veikt-kvk-a" }).þf, "Sögu");
  assert.equal(formsOf({ name: "Anna", pattern: "veikt-kvk-a" }).ef, "Önnu");
});

test("explicit forms must name all four cases", () => {
  assert.throws(() => formsOf({ name: "Dæmi", forms: { nf: "Dæmi", þf: "Dæmi" } }), /needs/);
  assert.throws(() => formsOf({ name: "Vaki", pattern: "veikt-kvk-a" }), /ending in -a/);
});

for (const [line, want] of [
  ["Takk fyrir að prófa Vaki.", "Vaka"],
  ["Svar frá Vaki á vefnum.", "Vaka"],
  ["Þú getur prófað Vaki í dag.", "Vaka"],
  ["Spurningar um Vaki?", "Vaka"],
  ["Ekkert gerist án Vaki.", "Vaka"],
  ["Skrifaðu til\nVaki.", "Vaka"],
  ["PRÓFAÐU VAKI", "VAKA"],
]) {
  test(`catches: ${JSON.stringify(line)}`, () => {
    const hits = checkDeclension(line, { names: VAKI });
    assert.equal(hits.length, 1, JSON.stringify(hits));
    assert.equal(hits[0].level, "error");
    assert.deepEqual(hits[0].expected, [want]);
  });
}

for (const line of [
  "Vaki svarar gestum allan sólarhringinn.",
  "Takk fyrir að prófa Vaka.",
  "Svar frá Vaka.",
  "Farðu á vaki.chat til að sjá meira.",
  "Skoðaðu https://vaki.chat/um Vaki",
  "Try Vaki, with Vaki, from Vaki.",
  "Um Vaki-spjallið: það er opið.",
  "Það er gott að vaka lengi.",
  "Svar frá VakiSupport.",
]) {
  test(`leaves alone: ${JSON.stringify(line)}`, () => {
    assert.deepEqual(checkDeclension(line, { names: VAKI }).filter((h) => h.level === "error"), []);
  });
}

test("ambiguous governors only warn: 'við Vaki' can mean 'Vaki and I'", () => {
  const hits = checkDeclension("Við Vaki svörum saman.", { names: VAKI });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].level, "warning");
  assert.match(hits[0].message, /pronoun/);
});

test("line and column point at the name", () => {
  const [hit] = checkDeclension("Halló.\nTakk fyrir að prófa Vaki.", { names: VAKI });
  assert.equal(hit.line, 2);
  assert.equal(hit.column, 21);
  assert.equal(hit.found, "Vaki");
});

test("feminine name: frá Saga is wrong, frá Sögu is right", () => {
  const names = [{ name: "Saga", pattern: "veikt-kvk-a" }];
  assert.deepEqual(checkDeclension("Kveðja frá Saga.", { names })[0].expected, ["Sögu"]);
  assert.deepEqual(checkDeclension("Kveðja frá Sögu.", { names }), []);
});

// Vaki is a weak masculine noun, so no feminine form ("Vöku", "Vakan") is ever a form of it.
test("Vöku, Vakan and the other feminine forms are hard errors for Vaki, anywhere in the text", () => {
  for (const [text, found] of [
    ["Kveðja frá Vöku.", "Vöku"],
    ["Prófaðu Vöku í dag.", "Vöku"],
    ["Vöku svarar ekki.", "Vöku"],
    ["Vakan svarar gestum.", "Vakan"],
    ["Spurðu Vökuna.", "Vökuna"],
    ["Í stjórnborði Vökunnar.", "Vökunnar"],
  ]) {
    const hits = checkDeclension(text, { names: VAKI });
    assert.equal(hits.length, 1, text);
    assert.equal(hits[0].level, "error", text);
    assert.equal(hits[0].found, found, text);
    assert.deepEqual(hits[0].expected, ["Vaka"], text);
  }
  assert.equal(fixDeclension("Kveðja frá Vöku.", { names: VAKI }), "Kveðja frá Vaka.");
  // The right forms and lower-case "vöku" (the word for a vigil) are left alone.
  assert.deepEqual(checkDeclension("Kveðja frá Vaka. Vaki svarar. Hún var á vöku.", { names: VAKI }), []);
});

test("a name whose nominative equals the governed case is never flagged", () => {
  const names = [{ name: "Dæmi", forms: { nf: "Dæmi", þf: "Dæmi", þgf: "Dæmi", ef: "Dæmis" } }];
  assert.deepEqual(checkDeclension("Kveðja frá Dæmi.", { names }), []);
  assert.deepEqual(checkDeclension("Án Dæmi.", { names })[0].expected, ["Dæmis"]);
});

test("fixDeclension fixes errors with one answer and keeps warnings", () => {
  const text = "Takk fyrir að prófa Vaki! Svar frá Vaki. Við Vaki tölum saman. Sjá vaki.chat";
  assert.equal(fixDeclension(text, { names: VAKI }), "Takk fyrir að prófa Vaka! Svar frá Vaka. Við Vaki tölum saman. Sjá vaki.chat");
});

test("a custom governor list replaces the bundled one", () => {
  const governors = [{ word: "hæ", cases: ["þf"] }];
  assert.equal(checkDeclension("hæ Vaki", { names: VAKI, governors }).length, 1);
  assert.equal(checkDeclension("frá Vaki", { names: VAKI, governors }).length, 0);
});
