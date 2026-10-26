// Banned-phrase and house-style checker for Icelandic (and English) copy.
//
// Grammar tools find errors. This finds words that are correct Icelandic but
// wrong for your brand: stiff loan words, sales clichés, VAT talk in prices,
// the long dash. The lists are JSON files you own: rules/is/ holds the Icelandic
// rules, one file per group, and rules/en-house-style.json the English ones.
// Each rule says why, and what to say instead.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LB, RB, escapeRe, maskAddresses, visibleText, lineCol, lineAt, keepCase } from "./text.mjs";
import { detectLanguage } from "./language.mjs";

const BUNDLED = {
  is: new URL("../rules/is/", import.meta.url),
  en: new URL("../rules/en-house-style.json", import.meta.url),
};

/** Rules from a file or folder path, a parsed object, or a bundled name ("is", "en"). Bundled rules carry their language. */
export function loadRules(source = "is") {
  if (Array.isArray(source)) return source.flatMap((s) => loadRules(s));
  if (typeof source === "string") {
    const where = BUNDLED[source] ? fileURLToPath(BUNDLED[source]) : source;
    const lang = BUNDLED[source] ? source : undefined;
    const files = fs.statSync(where).isDirectory()
      ? fs.readdirSync(where).filter((f) => f.endsWith(".json")).sort().map((f) => path.join(where, f))
      : [where];
    const rules = files.flatMap((f) => loadRules(JSON.parse(fs.readFileSync(f, "utf8"))));
    const ids = new Set();
    for (const r of rules) {
      if (ids.has(r.id)) throw new Error(`rule id twice: ${r.id}`);
      ids.add(r.id);
    }
    return lang ? rules.map((r) => ({ lang, ...r })) : rules;
  }
  const rules = source.rules ?? source;
  for (const r of rules) {
    if (!r.id || !r.why || !r.pattern) throw new Error(`a rule needs id, why and pattern: ${JSON.stringify(r).slice(0, 80)}`);
    if (r.scope && !["all", "product"].includes(r.scope)) throw new Error(`${r.id}: scope is "all" or "product"`);
  }
  return source.lang ? rules.map((r) => ({ lang: source.lang, ...r })) : rules;
}

const compiled = new Map();
/** The rule's pattern as a global RegExp, with {LB} and {RB} expanded. */
export function compileRule(rule) {
  const flags = rule.flags ?? "iu";
  const src = rule.pattern.replaceAll("{LB}", LB).replaceAll("{RB}", RB);
  const key = src + "/" + flags;
  if (!compiled.has(key)) compiled.set(key, new RegExp(src, flags.includes("g") ? flags : flags + "g"));
  const re = compiled.get(key);
  re.lastIndex = 0;
  return re;
}

const ICELANDIC_LETTERS = /[þðæöÞÐÆÖ]/;
// A short question like "Er sókn innifalin?" has no þ, ð, æ or ö: an accented vowel counts when a common
// Icelandic word is on the line too (Spanish "confirmó ella" has the vowel but not the word).
const ACCENTED = /[áéíóúýÁÉÍÓÚÝ]/;
const ICELANDIC_WORD = /(?<!\p{L})(?:er|eru|og|að|ég|hvar|hvað|hvernig|hvenær|get|má|fyrir|með|frá|til|ekki|hægt)(?!\p{L})/iu;
const looksIcelandic = (line) => ICELANDIC_LETTERS.test(line) || (ACCENTED.test(line) && ICELANDIC_WORD.test(line));
/**
 * Does a rule for this language belong on this line? A line read as Icelandic counts, and so does a short or
 * unclear line with Icelandic letters; an English line with an Icelandic place name in it does not.
 */
function lineLanguageFits(ruleLang, line) {
  if (!ruleLang) return true;
  const guess = detectLanguage(line).lang;
  if (ruleLang === "is") return guess === "is" || (guess === "unknown" && looksIcelandic(line));
  return guess === ruleLang;
}

/**
 * Every hit: [{ rule, severity, line, column, match, why, suggest, context }].
 * scope "all" (default) runs rules for every text; "product" also runs the product-copy rules.
 * fileName lets HTML be read as a visitor sees it (tags, style, script and comments skipped).
 * lang "auto" runs each rule only on lines in its language (an English page gets no Icelandic rules);
 * leave it out to run every rule on every line.
 */
export function checkStyle(text, { rules = loadRules("is"), scope = "all", fileName, lang } = {}) {
  const seen = visibleText(fileName, text);
  const masked = maskAddresses(seen);
  const hits = [];
  for (const rule of rules) {
    if ((rule.scope ?? "all") === "product" && scope !== "product") continue;
    for (const m of masked.matchAll(compileRule(rule))) {
      if (!m[0]) continue;
      const line = lineAt(text, m.index);
      if (rule.allowMarker && line.includes(rule.allowMarker)) continue;
      if (lang === "auto" && !lineLanguageFits(rule.lang, lineAt(seen, m.index))) continue;
      hits.push({
        rule: rule.id,
        severity: rule.severity ?? "error",
        ...lineCol(text, m.index),
        match: m[0],
        why: rule.why,
        suggest: rule.suggest,
        context: line.trim().slice(0, 160),
      });
    }
  }
  return hits.sort((a, b) => a.line - b.line || a.column - b.column);
}

/**
 * The text with every rule's "replace" words swapped (capitals kept, addresses
 * untouched). Byte for byte the same when nothing matched. Rules without a
 * replace map are only reported, never rewritten.
 */
export function rewriteStyle(text, { rules = loadRules("is"), scope = "all" } = {}) {
  const map = new Map();
  for (const rule of rules) {
    if ((rule.scope ?? "all") === "product" && scope !== "product") continue;
    for (const [from, to] of Object.entries(rule.replace ?? {})) map.set(from.toLowerCase(), to);
  }
  if (!map.size) return text;
  const keys = [...map.keys()].sort((a, b) => b.length - a.length).map((k) => escapeRe(k).replace(/ /g, "\\s+"));
  const re = new RegExp(`${LB}(?:${keys.join("|")})${RB}`, "giu");
  const masked = maskAddresses(text);
  let out = "";
  let last = 0;
  for (const m of masked.matchAll(re)) {
    const original = text.slice(m.index, m.index + m[0].length);
    const to = map.get(original.toLowerCase().replace(/\s+/g, " "));
    out += text.slice(last, m.index) + keepCase(original, to);
    last = m.index + m[0].length;
  }
  return last === 0 ? text : out + text.slice(last);
}
