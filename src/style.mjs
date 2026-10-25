// Banned-phrase and house-style checker for Icelandic (and English) copy.
//
// Grammar tools find errors. This finds words that are correct Icelandic but
// wrong for your brand: stiff loan words, sales clichés, VAT talk in prices,
// the long dash. The list is a JSON file you own (rules/is-house-style.json is
// an example). Each rule says why, so a writer knows what to do instead.

import fs from "node:fs";
import { LB, RB, escapeRe, maskAddresses, visibleText, lineCol, lineAt, keepCase } from "./text.mjs";

const BUNDLED = {
  is: new URL("../rules/is-house-style.json", import.meta.url),
  en: new URL("../rules/en-house-style.json", import.meta.url),
};

/** Rules from a file path, a parsed object, or a bundled name ("is", "en"). */
export function loadRules(source = "is") {
  if (Array.isArray(source)) return source.flatMap((s) => loadRules(s));
  if (typeof source === "string") {
    const file = BUNDLED[source] ?? source;
    return loadRules(JSON.parse(fs.readFileSync(file, "utf8")));
  }
  const rules = source.rules ?? source;
  for (const r of rules) {
    if (!r.id || !r.why || !r.pattern) throw new Error(`a rule needs id, why and pattern: ${JSON.stringify(r).slice(0, 80)}`);
    if (r.scope && !["all", "product"].includes(r.scope)) throw new Error(`${r.id}: scope is "all" or "product"`);
  }
  return rules;
}

/** The rule's pattern as a global RegExp, with {LB} and {RB} expanded. */
export function compileRule(rule) {
  const flags = rule.flags ?? "iu";
  const src = rule.pattern.replaceAll("{LB}", LB).replaceAll("{RB}", RB);
  return new RegExp(src, flags.includes("g") ? flags : flags + "g");
}

/**
 * Every hit: [{ rule, severity, line, column, match, why, suggest, context }].
 * scope "all" (default) runs rules for every text; "product" also runs the product-copy rules.
 * fileName lets HTML be read as a visitor sees it (tags, style, script and comments skipped).
 */
export function checkStyle(text, { rules = loadRules("is"), scope = "all", fileName } = {}) {
  const seen = visibleText(fileName, text);
  const masked = maskAddresses(seen);
  const hits = [];
  for (const rule of rules) {
    if ((rule.scope ?? "all") === "product" && scope !== "product") continue;
    for (const m of masked.matchAll(compileRule(rule))) {
      if (!m[0]) continue;
      const line = lineAt(text, m.index);
      if (rule.allowMarker && line.includes(rule.allowMarker)) continue;
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
