// Small text helpers shared by every tool.
//
// The one lesson behind all of them: in JavaScript, \b only knows ASCII word
// characters, so it sees no word edge before "Þ" or after "ð". A pattern ending
// in \b silently misses most Icelandic words. Use these letter lookarounds instead.

/** No letter, digit or underscore just before. */
export const LB = "(?<![\\p{L}\\p{N}_])";
/** No letter, digit or underscore just after. */
export const RB = "(?![\\p{L}\\p{N}_])";

export function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Web addresses, e-mail addresses and bare domains. A checker must never rewrite
// or flag these: "vaki.chat" is a domain, not the word "Vaki".
const ADDRESS = /(?:https?:\/\/|www\.)[^\s<>"'`)\]]+|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+\.[\p{L}\p{N}.-]+|(?<![\p{L}\p{N}_])[\p{L}\p{N}-]+\.(?:is|com|net|org|chat|io|dev|app|eu)(?![\p{L}\p{N}_])(?:\/[^\s<>"'`)\]]*)?/giu;

/** The same text with every address blanked to spaces, so indexes still line up. */
export function maskAddresses(text) {
  return text.replace(ADDRESS, (m) => " ".repeat(m.length));
}

/** What a reader actually sees in a file: for HTML, style, script and comments are blanked (line count kept). */
export function visibleText(fileName, text) {
  if (!/\.html?$/i.test(fileName || "")) return text;
  const blank = (m) => m.replace(/[^\n]/g, " ");
  return text
    .replace(/<style[\s\S]*?<\/style>/gi, blank)
    .replace(/<script[\s\S]*?<\/script>/gi, blank)
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/<[^>]*>/g, blank);
}

/** 1-based line and column of an index. */
export function lineCol(text, index) {
  const before = text.slice(0, index);
  const line = before.split("\n").length;
  const column = index - before.lastIndexOf("\n");
  return { line, column };
}

/** The line that holds an index. */
export function lineAt(text, index) {
  const start = text.lastIndexOf("\n", index - 1) + 1;
  const end = text.indexOf("\n", index);
  return text.slice(start, end === -1 ? text.length : end);
}

/** "to" with the capitalisation of "from": first letter, or all capitals. */
export function keepCase(from, to) {
  if (from.length > 1 && from === from.toUpperCase() && from !== from.toLowerCase()) return to.toUpperCase();
  if (from[0] !== from[0].toLowerCase()) return to[0].toUpperCase() + to.slice(1);
  return to;
}
