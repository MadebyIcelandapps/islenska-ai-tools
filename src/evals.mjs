// Answer evals for a customer-facing assistant that writes Icelandic.
//
// A suite is a JSON file of cases (a guest message, the facts the assistant was
// given, and what a good reply must and must not do). The runner scores saved
// replies: it never calls a model, so it costs nothing and gives the same answer
// every time. Generate replies with whatever you use, save them as
// { "case-id": "reply" }, and run the suite over them.
//
// Checks, each one named in the result:
//   global:<name>   a pattern no reply may contain (suite.globalMustNot)
//   must:<pattern>  the reply must contain this
//   mustNot:<name>  the reply must not contain this
//   language        the reply is in the case's language (Icelandic typed without its letters counts as Icelandic)
//   language-mix    no whole sentence slips into another language
//   numbers         every number can be traced to the facts or the guest's own words
//   deferral        the reply hands over to a person (wantsDeferral: the facts do not cover the question)
//   no-deferral     the reply answers instead of handing over (mustNotDefer: the facts do cover it)
//   booking-claim   the reply does not say a booking was made (mustNotClaimBooking)
//   style:<rule>    house-style rules (suite.styleRules)
//   declension      names in the right case (suite.names)

import fs from "node:fs";
import { detectLanguage, foreignSentences } from "./language.mjs";
import { untracedNumbers } from "./numbers.mjs";
import { checkStyle, loadRules } from "./style.mjs";
import { checkDeclension } from "./declension.mjs";

/** A reply that hands the question to a person, in Icelandic or English. */
export const DEFERRAL =
  /(?<![\p{L}])(?:(?:er|ég er) ekki með (?:upplýsingar|svar|verð)|hef ekki (?:upplýsingar|svar)|veit (?:það )?ekki|get ekki svarað|starfsfólk\p{L}*|hef(?:ur|ja)? samband|haft samband|kem(?:ur)? aftur til þín|læt (?:\p{L}+ )?vita|don'?t have (?:that|this|any|the)|not sure|(?:a|one of our) (?:person|team member|colleague)|member of (?:our|the) team|get back to you|pass (?:this|it) on)(?![\p{L}])/iu;

/** A reply that says a booking was made. */
export const BOOKING_CLAIM =
  /(?<![\p{L}])(?:(?:þú ert|þið eruð) (?:bókað|bókuð|bókaður|bókaðar)|bókunin (?:er|hefur verið) (?:staðfest|gerð|skráð)|ég (?:hef|er búin að|er búinn að) bókað?|herbergið er frátekið|you(?:'re| are) (?:all )?booked|booking (?:is|has been) (?:confirmed|made)|i(?:'ve| have) booked|reserved for you)(?![\p{L}])/iu;

export function loadSuite(file) {
  const suite = JSON.parse(fs.readFileSync(file, "utf8"));
  const ids = new Set();
  for (const c of suite.cases ?? []) {
    if (!c.id || !c.language || !(c.message || c.turns?.length)) throw new Error(`a case needs id, language and message or turns: ${JSON.stringify(c).slice(0, 80)}`);
    if (ids.has(c.id)) throw new Error(`case id twice: ${c.id}`);
    ids.add(c.id);
  }
  return suite;
}

const guestWords = (c) => (c.turns?.length ? c.turns : [c.message]);
const re = (src) => new RegExp(src, "iu");

/** Every check for one reply: [{ check, pass, detail }]. */
export function runChecks(suite, c, reply) {
  const out = [];
  const add = (check, pass, detail = "") => out.push({ check, pass, detail });

  for (const g of suite.globalMustNot ?? []) {
    const m = reply.match(re(g.pattern));
    add(`global:${g.name}`, !m, m ? `"${m[0]}": ${g.why}` : "");
  }
  for (const p of c.must ?? []) add(`must:${p}`, re(p).test(reply), "the reply must contain this");
  for (const n of c.mustNot ?? []) {
    const m = reply.match(re(n.pattern));
    add(`mustNot:${n.name}`, !m, m ? `"${m[0]}": ${n.why}` : "");
  }

  const lang = detectLanguage(reply);
  add("language", lang.lang === c.language, lang.lang === c.language ? "" : `expected ${c.language}, read as ${lang.lang} ${JSON.stringify(lang.score)}`);
  const foreign = foreignSentences(reply, c.language);
  add("language-mix", foreign.length === 0, foreign.map((f) => `${f.lang}: "${f.sentence}"`).join("; "));

  const facts = [suite.facts, c.facts].filter(Boolean);
  if (facts.length && c.numbersTraceable !== false) {
    const extra = untracedNumbers(reply, [...facts, ...guestWords(c)], { allow: c.allowNumbers ?? [] });
    add("numbers", extra.length === 0, extra.length ? `not in the facts or the guest's words: ${extra.map((n) => n.raw).join(", ")}` : "");
  }

  if (c.wantsDeferral) add("deferral", DEFERRAL.test(reply), "the facts do not cover this, so a person should take it");
  if (c.mustNotDefer) {
    const m = reply.match(DEFERRAL);
    add("no-deferral", !m, m ? `handed over ("${m[0]}") although the facts cover it` : "");
  }
  if (c.mustNotClaimBooking) {
    const m = reply.match(BOOKING_CLAIM);
    add("booking-claim", !m, m ? `"${m[0]}": nothing was booked` : "");
  }

  if (suite.styleRules) {
    const rules = loadRules(suite.styleRules);
    const hits = checkStyle(reply, { rules, scope: suite.styleScope ?? "all" }).filter((h) => h.severity === "error");
    for (const rule of new Set(rules.map((r) => r.id))) {
      const mine = hits.filter((h) => h.rule === rule);
      if (mine.length) add(`style:${rule}`, false, mine.map((h) => `"${h.match}": ${h.why}`).join("; "));
    }
    add("style", hits.length === 0, hits.length ? `${hits.length} house-style hit(s)` : "");
  }
  if (suite.names?.length) {
    const hits = checkDeclension(reply, { names: suite.names }).filter((h) => h.level === "error");
    add("declension", hits.length === 0, hits.map((h) => h.message).join("; "));
  }
  return out;
}

/** Scores every case that has a reply. { total, scored, passed, failed: [{ id, failures }], missing: [ids] } */
export function runSuite(suite, replies) {
  const result = { total: suite.cases.length, scored: 0, passed: 0, failed: [], missing: [] };
  for (const c of suite.cases) {
    const reply = replies[c.id];
    if (typeof reply !== "string") {
      result.missing.push(c.id);
      continue;
    }
    result.scored++;
    const failures = runChecks(suite, c, reply).filter((r) => !r.pass);
    if (failures.length) result.failed.push({ id: c.id, failures });
    else result.passed++;
  }
  return result;
}
