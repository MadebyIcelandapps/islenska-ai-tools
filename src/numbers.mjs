// Numbers in Icelandic and English text, and whether each one can be traced.
//
// Icelandic writes 24.900 for twenty-four thousand nine hundred and 114,5 for a
// decimal; English writes 24,900 and 114.5. A reply that turns 24.900 kr into
// 24,900 ISK says the same number; a reply that says 29.900 invented one. The
// rule for a customer-facing reply: every number in it must come from the facts
// it was given or from the customer's own message.

import { maskAddresses } from "./text.mjs";

const NUMBER = /(?<![\p{L}\p{N}])(\d{1,2}:\d{2}|\d{1,3}(?:[.,]\d{3})+(?![.,]?\d)|\d+[.,]\d{1,2}(?!\d)|\d+)/gu;

/** [{ raw, value, index }]. value is a number, or "hh:mm" for a clock time. Addresses are skipped. */
export function extractNumbers(text) {
  const out = [];
  for (const m of maskAddresses(text).matchAll(NUMBER)) {
    const raw = m[1];
    let value;
    if (/^\d{1,2}:\d{2}$/.test(raw)) value = raw.padStart(5, "0");
    else if (/^\d{1,3}(?:[.,]\d{3})+$/.test(raw)) value = Number(raw.replace(/[.,]/g, ""));
    else value = Number(raw.replace(",", "."));
    out.push({ raw, value, index: m.index });
  }
  return out;
}

/**
 * The numbers in reply that appear in none of the sources.
 * allowUpTo: whole numbers up to this are free ("1 nótt"); allow: extra values that are fine.
 */
export function untracedNumbers(reply, sources, { allowUpTo = 1, allow = [] } = {}) {
  const known = new Set(allow.map(String));
  for (const s of sources) for (const n of extractNumbers(s ?? "")) known.add(String(n.value));
  return extractNumbers(reply).filter(
    (n) => !known.has(String(n.value)) && !(typeof n.value === "number" && Number.isInteger(n.value) && n.value <= allowUpTo),
  );
}
