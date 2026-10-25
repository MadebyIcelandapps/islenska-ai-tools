// Declension checker for names (product names, brand names, nicknames).
//
// Icelandic nouns change with the case. A brand name like "Vaki" declines like a
// weak masculine noun: Vaki (nf), Vaka (þf), Vaka (þgf), Vaka (ef). So
// "prófaðu Vaki" and "frá Vaki" are wrong, "prófaðu Vaka" and "frá Vaka" are right.
// Grammar tools know the words in BÍN; they do not know your new brand. Here you
// tell the checker the name and its forms, and it flags the nominative right
// after a word that governs another case.
//
// No BÍN data is used or shipped. For the forms of an existing word, look it up
// yourself at https://bin.arnastofnun.is/ and give them as "forms".

import fs from "node:fs";
import { LB, escapeRe, maskAddresses, lineCol, keepCase } from "./text.mjs";

export const CASES = ["nf", "þf", "þgf", "ef"];
export const CASE_NAMES = { nf: "nefnifall", þf: "þolfall", þgf: "þágufall", ef: "eignarfall" };

const GOVERNORS_FILE = new URL("../rules/governors.json", import.meta.url);

/** The bundled list of words that govern a case (see rules/governors.json). */
export function defaultGovernors() {
  return JSON.parse(fs.readFileSync(GOVERNORS_FILE, "utf8")).governors;
}

// u-umlaut: an "a" in the last syllable of the stem turns into "ö" before an ending
// in -u (Saga > Sögu, Anna > Önnu). Irregular names: give the forms.
function uUmlaut(stem) {
  const i = Math.max(stem.lastIndexOf("a"), stem.lastIndexOf("A"));
  if (i === -1) return stem;
  return stem.slice(0, i) + (stem[i] === "A" ? "Ö" : "ö") + stem.slice(i + 1);
}

/**
 * The four forms of a name.
 * pattern "veikt-kk-i": weak masculine in -i (Vaki, Bragi, Ari): -i, -a, -a, -a.
 * pattern "veikt-kvk-a": weak feminine in -a (Saga, Anna, Sunna): -a, -u, -u, -u with u-umlaut.
 * Or give forms: { nf, þf, þgf, ef } for anything else.
 */
export function formsOf({ name, pattern, forms }) {
  if (forms) {
    for (const c of CASES) if (!forms[c]) throw new Error(`${name || forms.nf}: forms needs ${CASES.join(", ")}`);
    return { ...forms };
  }
  if (pattern === "veikt-kk-i") {
    if (!/i$/i.test(name)) throw new Error(`${name}: pattern veikt-kk-i needs a name ending in -i`);
    const stem = name.slice(0, -1);
    const a = keepCase(name.slice(-1), "a");
    return { nf: name, þf: stem + a, þgf: stem + a, ef: stem + a };
  }
  if (pattern === "veikt-kvk-a") {
    if (!/a$/i.test(name)) throw new Error(`${name}: pattern veikt-kvk-a needs a name ending in -a`);
    const stem = uUmlaut(name.slice(0, -1));
    const u = keepCase(name.slice(-1), "u");
    return { nf: name, þf: stem + u, þgf: stem + u, ef: stem + u };
  }
  throw new Error(`${name}: give pattern "veikt-kk-i" or "veikt-kvk-a", or the four forms`);
}

/**
 * Forms that are never right for a weak masculine name in -i: the feminine ones. "Vöku" or
 * "Vakan" is not a form of Vaki in any way (it is a masculine noun), so these are errors
 * wherever they stand, not only after a governing word.
 */
export function wrongFormsOf({ name, pattern }) {
  if (pattern !== "veikt-kk-i") return [];
  const stem = name.slice(0, -1);
  const um = uUmlaut(stem);
  return [...new Set([um + "u", stem + "u", stem + "an", um + "una", um + "unni", um + "unnar"])];
}

function wrongFormHits(text, list) {
  const hits = [];
  for (const n of list) {
    const wrong = wrongFormsOf(n);
    if (!wrong.length) continue;
    const re = new RegExp(`${LB}(${wrong.map(escapeRe).join("|")})(?![\\p{L}\\p{N}_])`, "gu");
    for (const m of text.matchAll(re)) {
      const expected = [keepCase(m[1], n.forms.þf)];
      hits.push({
        index: m.index,
        ...lineCol(text, m.index),
        governor: null,
        found: m[1],
        expected,
        cases: ["þf", "þgf", "ef"],
        level: "error",
        message: `"${m[1]}" er ekki til sem beyging af ${n.forms.nf} (karlkynsorð: ${n.forms.nf}, ${n.forms.þf}, ${n.forms.þgf}, ${n.forms.ef}), svo "${expected[0]}"`,
      });
    }
  }
  return hits;
}

function compile(names, governors) {
  const list = names.map((n) => ({ ...n, forms: formsOf(n) }));
  const byWord = new Map(governors.map((g) => [g.word.toLowerCase(), g]));
  // Longest first, so "á milli" wins over "á".
  const words = [...byWord.keys()].sort((a, b) => b.length - a.length).map((w) => escapeRe(w).replace(/ /g, "\\s+"));
  const nomForms = list.map((n) => escapeRe(n.forms.nf));
  // The name must stand alone: not part of a longer word, not a domain (vaki.chat), not the first part of a compound (Vaki-spjall).
  const re = new RegExp(
    `${LB}(${words.join("|")})(\\s+)(${nomForms.join("|")})(?![\\p{L}\\p{N}_])(?!\\.[\\p{L}])(?!-[\\p{L}])`,
    "giu",
  );
  return { list, byWord, re };
}

/**
 * Every place where a name stands in the nominative right after a word that
 * governs another case. Returns [{ index, line, column, governor, found, expected, cases, level, message }].
 * level is "error", or "warning" when the governing word has another use (see rules/governors.json).
 */
export function checkDeclension(text, { names, governors = defaultGovernors() } = {}) {
  if (!names?.length) throw new Error("checkDeclension needs names, e.g. [{ name: 'Vaki', pattern: 'veikt-kk-i' }]");
  const { list, byWord, re } = compile(names, governors);
  const masked = maskAddresses(text);
  const hits = [];
  for (const m of masked.matchAll(re)) {
    const govWord = m[1].toLowerCase().replace(/\s+/g, " ");
    const gov = byWord.get(govWord);
    const name = list.find((n) => n.forms.nf.toLowerCase() === m[3].toLowerCase());
    // A name is written with a capital. Lower case "vaka" is also a verb (að vaka = to stay awake), so it is
    // only checked when the name says anyCase: true.
    if (!name.anyCase && m[3][0] === m[3][0].toLowerCase()) continue;
    // The nominative is right when the governed case has the same form (a name with nf = þf, for example).
    const wrongCases = gov.cases.filter((c) => name.forms[c].toLowerCase() !== name.forms.nf.toLowerCase());
    if (!wrongCases.length) continue;
    const expected = [...new Set(gov.cases.map((c) => keepCase(m[3], name.forms[c])))];
    const at = m.index + m[1].length + m[2].length;
    const where = lineCol(text, at);
    const caseWords = gov.cases.map((c) => CASE_NAMES[c]).join(" eða ");
    hits.push({
      index: at,
      ...where,
      governor: m[1],
      found: text.slice(at, at + m[3].length),
      expected,
      cases: gov.cases,
      level: gov.ambiguous ? "warning" : "error",
      message: `"${m[1]} ${m[3]}": "${m[1]}" stýrir ${caseWords}, svo "${expected.join("\" eða \"")}"` + (gov.ambiguous ? ` (athugaðu: ${gov.ambiguous})` : ""),
    });
  }
  hits.push(...wrongFormHits(masked, list));
  return hits.sort((a, b) => a.index - b.index);
}

/** The text with every error fixed that has one right answer. Warnings and two-way cases are left for a person. */
export function fixDeclension(text, options) {
  const hits = checkDeclension(text, options).filter((h) => h.level === "error" && h.expected.length === 1);
  let out = text;
  for (const h of hits.sort((a, b) => b.index - a.index)) out = out.slice(0, h.index) + h.expected[0] + out.slice(h.index + h.found.length);
  return out;
}
