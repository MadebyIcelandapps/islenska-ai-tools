import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const scan = new URL("../scripts/scan.mjs", import.meta.url).pathname;

// Fake values, built at run time so this file itself never holds one. None can belong to anyone:
// the kennitala fails its check digit, the phone number is all zeros, the domain is the reserved .invalid.
const fake = {
  key: "sk-" + "ant-" + "x".repeat(24),
  mail: "jon" + "@" + "fyrirtaeki.invalid",
  phone: "+" + "354 " + "000 0000",
  kt: "120" + "190-" + "2389",
  url: "https://" + "booking.fyrirtaeki.invalid/admin",
};

function repoWith(files, message = "test") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "islenska-scan-"));
  const g = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8" });
  g("init", "-q");
  g("config", "user.email", "t@example.com");
  g("config", "user.name", "t");
  // The planted fake keys must reach the commit: a machine-wide git hook (core.hooksPath) is not used here.
  g("config", "core.hooksPath", "/dev/null");
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  g("add", "-A");
  g("commit", "-q", "-m", message);
  return { dir, g };
}

test("a clean repo gives 0 hits and exit 0", () => {
  const { dir } = repoWith({ "a.txt": "Verð: 24.900 kr. Sjá https://example.com/x og jon@example.com\n" });
  const r = spawnSync(process.execPath, [scan], { cwd: dir, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /: 0 hits/);
});

test("every planted value is found, also when deleted from the latest commit", () => {
  const { dir, g } = repoWith({ "a.txt": Object.values(fake).join("\n") + "\n" });
  fs.writeFileSync(path.join(dir, "a.txt"), "hreint\n");
  g("commit", "-q", "-am", "remove");
  const r = spawnSync(process.execPath, [scan], { cwd: dir, encoding: "utf8" });
  assert.equal(r.status, 1);
  for (const label of ["openai or anthropic key", "e-mail address", "phone number with country code", "kennitala", "web address not on the public-source list"]) {
    assert.match(r.stdout, new RegExp(`\\[${label}\\]`), `missed ${label}:\n${r.stdout}`);
  }
});

test("commit messages are scanned, and listed terms from a private file", () => {
  const { dir } = repoWith({ "a.txt": "Gestur frá Fyrirtækinu Dæmi.\n" }, "fix for " + fake.mail);
  const terms = path.join(dir, "..", path.basename(dir) + "-terms.txt");
  fs.writeFileSync(terms, "# private\nFyrirtækinu Dæmi\n");
  const r = spawnSync(process.execPath, [scan, "--extra", terms], { cwd: dir, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /commit \w+ message:1 \[e-mail address\]/);
  assert.match(r.stdout, /\[listed term "Fy\*+"\] \(term hidden\)/);
  assert.doesNotMatch(r.stdout, /Fyrirtækinu/, "a listed term is never printed");
});
