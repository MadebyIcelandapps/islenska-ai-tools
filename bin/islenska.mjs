#!/usr/bin/env node
// islenska: run the checkers from the command line. Exit 0 when clean, 1 on errors, 2 on bad usage.
//
//   islenska style <file...> [--rules is|en|path.json] [--product]
//   islenska declension <file...> --name Vaki:veikt-kk-i [--name Vaka:veikt-kvk-a]
//   islenska eval <suite.json> <replies.json>

import fs from "node:fs";
import { checkStyle, loadRules } from "../src/style.mjs";
import { checkDeclension } from "../src/declension.mjs";
import { loadSuite, runSuite } from "../src/evals.mjs";

const [cmd, ...args] = process.argv.slice(2);
const flag = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));
const VALUE_FLAGS = new Set(["--rules", "--name"]);
const files = args.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.has(args[i - 1]));

function usage() {
  console.error("usage:\n  islenska style <file...> [--rules is|en|file.json] [--product]\n  islenska declension <file...> --name Vaki:veikt-kk-i\n  islenska eval <suite.json> <replies.json>");
  process.exit(2);
}

if (cmd === "style") {
  if (!files.length) usage();
  const rules = loadRules(flag("--rules").length ? flag("--rules") : ["is", "en"]);
  let errors = 0;
  for (const f of files) {
    for (const h of checkStyle(fs.readFileSync(f, "utf8"), { rules, fileName: f, scope: args.includes("--product") ? "product" : "all" })) {
      if (h.severity === "error") errors++;
      console.log(`${f}:${h.line}:${h.column} ${h.severity} [${h.rule}] "${h.match}": ${h.why}${h.suggest ? ` (try: ${h.suggest})` : ""}`);
    }
  }
  console.log(errors ? `${errors} error(s)` : "clean");
  process.exit(errors ? 1 : 0);
} else if (cmd === "declension") {
  const names = flag("--name").map((n) => {
    const [name, pattern] = n.split(":");
    return { name, pattern };
  });
  if (!files.length || !names.length) usage();
  let errors = 0;
  for (const f of files) {
    for (const h of checkDeclension(fs.readFileSync(f, "utf8"), { names })) {
      if (h.level === "error") errors++;
      console.log(`${f}:${h.line}:${h.column} ${h.level} ${h.message}`);
    }
  }
  console.log(errors ? `${errors} error(s)` : "clean");
  process.exit(errors ? 1 : 0);
} else if (cmd === "eval") {
  if (files.length !== 2) usage();
  const suite = loadSuite(files[0]);
  const raw = JSON.parse(fs.readFileSync(files[1], "utf8"));
  const replies = Object.fromEntries(Object.entries(raw.replies ?? raw).map(([k, v]) => [k, typeof v === "string" ? v : v.reply]));
  const r = runSuite(suite, replies);
  for (const f of r.failed) for (const x of f.failures) console.log(`FAIL ${f.id} [${x.check}] ${x.detail}`);
  console.log(`${r.passed} of ${r.scored} scored cases passed (${r.total} in the suite, ${r.missing.length} without a reply)`);
  process.exit(r.failed.length ? 1 : 0);
} else usage();
