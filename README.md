# islenska-ai-tools

Íslensk tól til að yfirfara texta sem mállíkön skrifa til viðskiptavina. / Icelandic tools for checking text an AI writes to customers.

Engin líkanaköll, engin ytri forritasöfn, bara Node 20 eða nýrra. / No model calls, no dependencies, just Node 20 or newer.

[Íslenska](#íslenska) · [English](#english) · [RESEARCH.md](RESEARCH.md): hvað er til fyrir / what already exists

---

## Íslenska

### Hvað er í pakkanum

| Tól | Hvað það gerir |
| --- | --- |
| **Fallbeyging nafna** (`src/declension.mjs`) | Finnur vörumerki eða nafn í nefnifalli á eftir orði sem stýrir öðru falli: „prófa Vaki“ á að vera „prófa Vaka“, „frá Saga“ (kvk.) á að vera „frá Sögu“. Kvenkynsmyndir eins og „Vöku“ eða „Vakan“ eru alltaf villa fyrir karlkynsnafn eins og Vaki. Þú gefur nafnið og beygingarmynstur (veikt kk. á -i, veikt kvk. á -a) eða öll fjögur föllin. Lagar sjálfkrafa þar sem aðeins eitt svar er rétt. |
| **Stílreglur og bannorð** (`src/style.mjs`, `rules/*.json`) | Orð sem eru rétt íslenska en eiga ekki heima í textanum þínum: „smíðað“, „skrunaðu“, „spjallmenni“, „án vsk“, langt strik, sölufrasar. Hver regla segir af hverju og hvað á að segja í staðinn. Þú átt listann og breytir honum. |
| **Mat á svörum** (`src/evals.mjs`, `evals/`) | Prófar vistuð svör: er svarið á íslensku (líka þegar gesturinn skrifar án íslenskra stafa), koma allar tölur úr staðreyndunum, vísar það á starfsfólk þegar svarið vantar, segist það ekki hafa bókað þegar ekkert var bókað, eru stílreglur og fallbeyging í lagi. |
| **Tungumál og tölur** (`src/language.mjs`, `src/numbers.mjs`) | Greinir íslensku frá dönsku og ensku í stuttum svörum, og les 24.900 og 24,900 sem sömu tölu. |

### Keyrsla

```sh
node --test test/*.test.mjs                                   # öll próf
node bin/islenska.mjs style texti.html --product              # stílreglur, líka fyrir markaðstexta
node bin/islenska.mjs declension texti.txt --name Vaki:veikt-kk-i
node bin/islenska.mjs eval evals/is-guest-replies.json svor.json
node scripts/scan.mjs                                         # leita að lyklum og persónuupplýsingum í allri sögunni
```

Útgangskóði 0 þýðir hreint, 1 þýðir villur, 2 þýðir rangt notað.

### Að bæta við reglu

Opnaðu `rules/is-house-style.json` og bættu við hlut með `id`, `why` (af hverju), `pattern` (JavaScript regex; `{LB}` og `{RB}` eru orðaskil sem virka á íslenska stafi), `scope` (`all` eða `product`), og `examples` með `bad` og `good`. Prófin keyra öll dæmin sjálf: slæmt dæmi verður að veiða regluna og gott dæmi má engu reglu veiða.

Orð sem stýrir falli bætirðu í `rules/governors.json`. Merktu það `ambiguous` ef það hefur aðra merkingu þar sem nefnifall er rétt (eins og „við“ = „we“), þá verður það aðeins viðvörun.

Matsdæmi bætirðu í `evals/is-guest-replies.json`, með einu góðu svari í `evals/replies-good.json` og einu slæmu í `evals/replies-bad.json` sem á að falla á tilgreindu prófi.

### Gögn og leyfi

Kóðinn er undir MIT-leyfi (`LICENSE`). Matsgögnin í `evals/` eru undir CC BY 4.0 (`LICENSE-DATA`). Öll dæmi eru tilbúin: gistihúsið er skáldað og engin lína kemur frá raunverulegum gesti, fyrirtæki, tölvupósti eða símtali. Engin gögn úr BÍN fylgja; sjá [RESEARCH.md](RESEARCH.md).

---

## English

### What is in it

| Tool | What it does |
| --- | --- |
| **Name declension** (`src/declension.mjs`) | Finds a brand or name in the nominative after a word that governs another case: "prófa Vaki" should be "prófa Vaka", feminine "frá Saga" should be "frá Sögu". Feminine forms such as "Vöku" or "Vakan" are always an error for a masculine name like Vaki. You give the name and a pattern (weak masculine in -i, weak feminine in -a) or all four forms. It fixes the cases that have one right answer. |
| **House style and banned phrases** (`src/style.mjs`, `rules/*.json`) | Words that are correct Icelandic but wrong for your copy: "smíðað", "skrunaðu", "spjallmenni", "án vsk", the long dash, tired sales lines. Each rule says why and what to say instead. The list is yours to edit. |
| **Answer evals** (`src/evals.mjs`, `evals/`) | Scores saved replies: is the reply Icelandic (also when the guest typed without Icelandic letters), does every number come from the facts, does it hand over to staff when the answer is missing, does it avoid claiming a booking that was not made, do style and declension pass. |
| **Language and numbers** (`src/language.mjs`, `src/numbers.mjs`) | Tells Icelandic from Danish and English in short replies, and reads 24.900 and 24,900 as the same number. |

### Run it

```sh
node --test test/*.test.mjs                                   # every test
node bin/islenska.mjs style page.html --product               # style rules, product-copy rules too
node bin/islenska.mjs declension text.txt --name Vaki:veikt-kk-i
node bin/islenska.mjs eval evals/is-guest-replies.json replies.json
node scripts/scan.mjs                                         # secrets and personal data, whole git history
```

Exit code 0 means clean, 1 means findings, 2 means bad usage.

### Use it from code

```js
import { checkDeclension, fixDeclension } from "islenska-ai-tools/declension";
import { checkStyle, rewriteStyle } from "islenska-ai-tools/style";
import { loadSuite, runSuite } from "islenska-ai-tools/evals";

checkDeclension("Takk fyrir að prófa Vaki.", { names: [{ name: "Vaki", pattern: "veikt-kk-i" }] });
// [{ line: 1, column: 21, found: "Vaki", expected: ["Vaka"], level: "error", ... }]
```

### Add a rule

Open `rules/is-house-style.json` and add an entry with `id`, `why`, `pattern` (JavaScript regex; `{LB}` and `{RB}` are word edges that work on Icelandic letters, where `\b` does not), `scope` (`all` or `product`), and `examples` with `bad` and `good`. The tests run every example: a bad one must hit the rule, a good one must hit no rule.

Words that govern a case go in `rules/governors.json`. Mark one `ambiguous` when it has another use where the nominative is right (such as "við" = "we"); its hits are then warnings only.

Eval cases go in `evals/is-guest-replies.json`, with one good reply in `evals/replies-good.json` and one bad reply in `evals/replies-bad.json` that must fail on the check it names.

### Data and licences

Code: MIT (`LICENSE`). The eval data in `evals/`: CC BY 4.0 (`LICENSE-DATA`). The data has its own licence because it is used differently from code (copied into other test sets and datasets), and CC BY is the usual licence for that: anyone may reuse it with credit. It is not ShareAlike, which is fine because no BÍN data (CC BY-SA 4.0) is in it. Every example is synthetic: the guesthouse is made up and no line comes from a real guest, company, e-mail or call.

For grammar and spelling, use Miðeind's GreynirCorrect. For the forms of an existing Icelandic word, use BÍN from the Árni Magnússon Institute. See [RESEARCH.md](RESEARCH.md) for what exists and what this adds.

---

© 2026 Helgi Þór Jóhannsson (HTJ Studio).
