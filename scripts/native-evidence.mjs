#!/usr/bin/env node
// Counts how often native Icelandic writers use each rule's flagged form and its
// natural alternative, and writes the counts to rules/evidence.json.
//
//   node scripts/native-evidence.mjs [--only id,id] [--refresh]
//
// Source: the Icelandic Gigaword Corpus (Risamálheildin, Árni Magnússon Institute),
// searched through its public Korp service at malheildir.arnastofnun.is. Only the
// parts published under CC BY 4.0 are counted: news part 1 (Vísir, RÚV, Fréttablaðið,
// Mannlíf, up to 2023) and the social part (Bland, Hugi, Málefnin forums and Twitter,
// up to 2021). Only numbers are stored, never text. "recent" counts texts dated 2018
// or later; "all" counts every year. Recent use decides; all years break a tie at zero.
// One request a second, results cached in the output file so a rerun only asks for
// what is new.

import fs from "node:fs";
import { loadRules } from "../src/style.mjs";

const BACKEND = "https://malheildir.arnastofnun.is:1234";
export const CORPORA = [
  "IGC2410EXT_NEWS1_VISIR", "IGC2410EXT_NEWS1_RUV", "IGC2410EXT_NEWS1_FRETTABLADIDIS", "IGC2410EXT_NEWS1_MANNLIF",
  "IGC22_SOCIAL1_BLAND", "IGC22_SOCIAL1_HUGI", "IGC22_SOCIAL1_MALEFNIN", "IGC22_SOCIAL3",
];
const OUT = new URL("../rules/evidence.json", import.meta.url);
const RECENT = 20180101;

const args = process.argv.slice(2);
const only = args.includes("--only") ? new Set(args[args.indexOf("--only") + 1].split(",")) : null;
const refresh = args.includes("--refresh");

/** Adds the date condition to every token of a CQP query. */
export function recentQuery(cqp) {
  const date = `int(_.text_datefrom) >= ${RECENT}`;
  return cqp.replace(/\[([^\]]*)\]/g, (_, inner) => (inner.trim() ? `[${inner} & ${date}]` : `[${date}]`));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function hits(cqp) {
  const url = new URL(BACKEND + "/query");
  url.searchParams.set("corpus", CORPORA.join(","));
  url.searchParams.set("cqp", cqp);
  url.searchParams.set("start", "0");
  url.searchParams.set("end", "0");
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      const body = await res.json();
      if (typeof body.hits === "number") return body.hits;
      throw new Error(JSON.stringify(body.ERROR ?? body).slice(0, 200));
    } catch (e) {
      if (attempt === 3) throw e;
      await sleep(5000 * attempt);
    }
  }
}

async function main() {
  const store = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
  store._about = "Counts from the Icelandic Gigaword Corpus (CC BY 4.0 parts only), via malheildir.arnastofnun.is. recent = texts dated 2018 or later. Written by scripts/native-evidence.mjs; numbers only, no text.";
  store._corpora = CORPORA;
  store.rules ??= {};
  const rules = loadRules("is").filter((r) => r.evidence && (!only || only.has(r.id)));
  let asked = 0;
  for (const r of rules) {
    const old = store.rules[r.id];
    if (!refresh && old && old.flaggedQuery === r.evidence.flagged && old.naturalQuery === r.evidence.natural) continue;
    const row = { flaggedQuery: r.evidence.flagged, naturalQuery: r.evidence.natural };
    for (const [k, q] of [["flagged", r.evidence.flagged], ["natural", r.evidence.natural]]) {
      row[k] = { recent: await hits(recentQuery(q)), all: await hits(q) };
      asked += 2;
      await sleep(1000);
    }
    row.checked = new Date().toISOString().slice(0, 10);
    store.rules[r.id] = row;
    fs.writeFileSync(OUT, JSON.stringify(store, null, 1) + "\n");
    console.log(`${r.id}: flagged ${row.flagged.recent}/${row.flagged.all}  natural ${row.natural.recent}/${row.natural.all}`);
  }
  console.log(`done, ${asked} queries, ${Object.keys(store.rules).length} rules with counts`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
