import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const bin = new URL("../bin/islenska.mjs", import.meta.url).pathname;
const evals = (f) => new URL(`../evals/${f}`, import.meta.url).pathname;
const run = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: "utf8" });

function tmpFile(name, text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "islenska-"));
  const file = path.join(dir, name);
  fs.writeFileSync(file, text);
  return file;
}

test("style: exit 1 with the rule, 0 when clean, and --product before a file", () => {
  const badFile = tmpFile("a.txt", "Verð: 24.900 kr. án vsk.\n");
  const r = run("style", badFile);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /a\.txt:1:\d+ error \[vsk\]/);
  const product = tmpFile("b.txt", "Móttaka fyrir lítil fyrirtæki.\n");
  assert.equal(run("style", product).status, 0);
  assert.equal(run("style", "--product", product).status, 1);
});

test("declension: exit 1 on prófa Vaki", () => {
  const f = tmpFile("c.txt", "Takk fyrir að prófa Vaki.\n");
  const r = run("declension", f, "--name", "Vaki:veikt-kk-i");
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Vaka/);
});

test("eval: good replies pass, bad replies fail", () => {
  const ok = run("eval", evals("is-guest-replies.json"), evals("replies-good.json"));
  assert.equal(ok.status, 0, ok.stdout);
  assert.match(ok.stdout, /14 of 14 scored cases passed/);
  const no = run("eval", evals("is-guest-replies.json"), evals("replies-bad.json"));
  assert.equal(no.status, 1);
  assert.match(no.stdout, /0 of 14 scored cases passed/);
});

test("bad usage exits 2", () => {
  assert.equal(run().status, 2);
  assert.equal(run("declension", "x.txt").status, 2);
});
