#!/usr/bin/env node
// Secret and personal-data scan over the WHOLE git history: every version of
// every file ever committed, every commit message, and the files not yet committed.
// Exit 0 with "0 hits", or 1 with every hit listed.
//
//   node scripts/scan.mjs [--extra terms.txt]
//
// --extra: a file OUTSIDE this repo with one more term per line (names of
// companies or people that must never appear). It is kept outside on purpose,
// so the list itself is never published.

import { execFileSync } from "node:child_process";
import fs from "node:fs";

const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 1 << 28 });

const SECRETS = [
  ["aws key", /AKIA[0-9A-Z]{16}/],
  ["openai or anthropic key", /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/],
  ["github token", /\b(?:ghp|gho|ghs|ghu)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}/],
  ["slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["google key", /\bAIza[0-9A-Za-z_-]{35}/],
  ["jwt", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/],
  ["phone-service account id", /\b(?:AC|SK)[0-9a-f]{32}\b/],
  ["payment-service id", /\b(?:pri|pro|ctm|sub|txn|pdl)_01[a-z0-9]{20,}/],
  ["bearer token", /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/],
  ["key assignment", /\b(?:api[_-]?key|secret|token|password|passwd)\b\s*[:=]\s*["'][^"'\s]{8,}["']/i],
];
const PERSONAL = [
  ["e-mail address", /[\p{L}\p{N}._%+-]+@(?!example\.(?:com|org|net)\b)(?<!\bnoreply@(?=anthropic\.com))[\p{L}\p{N}-]+\.[\p{L}\p{N}.-]*\p{L}/u],
  ["phone number with country code", /(?:\+|00)\d{1,3}[ -]?\d{2,4}[ -]?\d{3,4}/],
  ["icelandic phone number", /(?<![\d.,:])[4-8]\d{2}[ -]?\d{4}(?![\d.,])/],
  ["kennitala", /(?<![\d.,])(?:[0-3]\d[01]\d\d{2})-?\d{4}(?![\d.,])/],
  ["ip address", /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])/],
];
// Web addresses must point to a known public source or our own public site. Anything else could be a client system.
// The commit attribution address noreply@anthropic.com is a public no-reply address and is allowed.
const OK_HOSTS = /^(?:vaki\.chat|example\.(?:com|org|net)|github\.com|raw\.githubusercontent\.com|huggingface\.co|bin\.arnastofnun\.is|almannaromur\.is|stadagervigreindar\.is|repository\.clarin\.is|clarin\.is|creativecommons\.org|opensource\.org|mideind\.is|greynir\.is|spdx\.org)$/i;

const extraFile = process.argv.includes("--extra") ? process.argv[process.argv.indexOf("--extra") + 1] : null;
const EXTRA = extraFile
  ? fs.readFileSync(extraFile, "utf8").split("\n").map((s) => s.trim()).filter((s) => s && !s.startsWith("#"))
      .map((line) => {
        // "=Term" is matched with its capitals as written; anything else ignores case. Spaces and hyphens may be either or missing.
        const exact = line.startsWith("=");
        const t = exact ? line.slice(1) : line;
        const src = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[ -]/g, "[ -]?");
        return [`listed term "${t.slice(0, 2)}${"*".repeat(Math.max(0, t.length - 2))}"`, new RegExp(`(?<![\\p{L}\\p{N}])${src}(?![\\p{L}\\p{N}])`, exact ? "u" : "iu")];
      })
  : [];

// The copyright line names the holder on purpose: listed terms are not checked on a line that starts
// "Copyright (c) 2026" or "© 2026", and only in LICENSE, LICENSE-DATA and README.md.
const HOLDER_FILES = /(?:^|:)(?:LICENSE|LICENSE-DATA|README\.md)$/;
const HOLDER_LINE = /^\s*(?:Copyright \(c\)|©) 2026 /;

function scanText(where, text, hits) {
  text.split("\n").forEach((line, i) => {
    const holder = HOLDER_FILES.test(where) && HOLDER_LINE.test(line);
    for (const [name, re] of [...SECRETS, ...PERSONAL, ...(holder ? [] : EXTRA)]) {
      const m = line.match(re);
      if (m) hits.push(`${where}:${i + 1} [${name}] ${name.startsWith("listed") ? "(term hidden)" : m[0].slice(0, 40)}`);
    }
    for (const m of line.matchAll(/https?:\/\/([^/\s"'<>)\]`]+)/g)) {
      if (!OK_HOSTS.test(m[1])) hits.push(`${where}:${i + 1} [web address not on the public-source list] ${m[0].slice(0, 60)}`);
    }
  });
}

const hits = [];
let blobs = 0;
const seen = new Set();
for (const line of git("rev-list", "--all", "--objects").split("\n")) {
  const [sha, ...rest] = line.split(" ");
  if (!sha || !rest.length || seen.has(sha)) continue;
  if (git("cat-file", "-t", sha).trim() !== "blob") continue;
  seen.add(sha);
  blobs++;
  scanText(`${sha.slice(0, 8)}:${rest.join(" ")}`, git("cat-file", "-p", sha), hits);
}
let commits = 0;
for (const c of git("rev-list", "--all").split("\n").filter(Boolean)) {
  commits++;
  scanText(`commit ${c.slice(0, 8)} message`, git("log", "-1", "--format=%B", c), hits);
}
const untracked = git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean);
for (const f of untracked) scanText(`untracked ${f}`, fs.readFileSync(f, "utf8"), hits);

for (const h of hits) console.log(h);
console.log(`scanned ${blobs} file versions, ${commits} commit messages, ${untracked.length} untracked files, ${SECRETS.length + PERSONAL.length} patterns + ${EXTRA.length} listed terms + web addresses: ${hits.length} hits`);
process.exit(hits.length ? 1 : 0);
