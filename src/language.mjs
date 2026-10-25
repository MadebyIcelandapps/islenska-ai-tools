// Is this reply Icelandic, Danish or English?
//
// Many Icelanders type on a foreign keyboard without þ, ð, æ or ö
// ("Hvad kostar herbergid og hvenaer er innritun?"). A detector that relies on
// those letters calls that Danish, because "hvad", "og" and "er" are Danish too,
// and then the assistant answers an Icelander in Danish. This guesser scores
// words that are Icelandic and NOT Danish, with and without the Icelandic
// letters, and leaves the shared words out. A heuristic, made for checking short
// customer replies, not a general language identifier.

const fold = (w) => w.replace(/þ/g, "th").replace(/ð/g, "d").replace(/æ/g, "ae").replace(/ö/g, "o").normalize("NFD").replace(/\p{M}/gu, "");

// Common in Icelandic replies, and not words in Danish or English. Written with Icelandic letters; the folded spelling counts too.
const IS = `ég þú það þetta þessi ekki hvað hvar hvenær hvernig kostar kosta herbergi herbergið herbergin innritun útritun
morgunmatur morgunmat takk bless já nei laust laus lausir bílastæði ókeypis nótt nóttina verð verðið verðinu innifalinn
eru hér svo við sjá sjáðu hafðu samband starfsfólk starfsfólkið veit þig þér hundar velkomnir prófað spjallinu halló
getur gæti má koma minn mína hundinn rútan rútunni flugvellinum allt húsið húsinu manna manns eins tveggja frá með
upplýsingar læt vita hefur`.split(/\s+/);
// "er", "frá", "um", "med", "her" fold onto Danish words, so only their Icelandic-letter spellings count.
const SHARED_WHEN_FOLDED = new Set(["er", "fra", "um", "med", "her", "ma", "hvad", "vid", "eg", "minn"]);
const IS_WORDS = new Set(IS);
const IS_FOLDED = new Set(IS.map(fold).filter((w) => !SHARED_WHEN_FOLDED.has(w)));

const DA = new Set(`ikke jeg det hvornår hvor meget koster værelset værelse værelser tak morgenmad indtjekning udtjekning fra kan du har
med her gerne velkommen nat pris prisen også`.split(/\s+/));
const EN = new Set(`the is are and how what much room rooms price you your i do does have has can we our free parking right outside yes
no it of for per night welcome goodbye single double there at from in a an this that will be breakfast included check sorry`.split(/\s+/));

/** Scores for is, da and en, and the best guess ("unknown" when nothing scores). */
export function detectLanguage(text) {
  const words = (text.toLowerCase().match(/\p{L}+/gu) ?? []);
  const score = { is: 0, da: 0, en: 0 };
  for (const w of words) {
    if (/[þð]/.test(w)) score.is += 2;
    if (/[øå]/.test(w)) score.da += 2;
    if (IS_WORDS.has(w)) score.is += 1;
    else if (IS_FOLDED.has(w)) score.is += 1;
    if (DA.has(w)) score.da += 1;
    if (EN.has(w)) score.en += 1;
  }
  const best = Object.entries(score).sort((a, b) => b[1] - a[1]);
  const lang = best[0][1] < 1 ? "unknown" : best[0][1] === best[1][1] ? "unknown" : best[0][0];
  return { lang, score };
}

/** Sentences of at least minWords words whose guess is a language other than the expected one. */
export function foreignSentences(text, expected, { minWords = 3 } = {}) {
  return text
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((s) => s.trim())
    .filter((s) => (s.match(/\p{L}+/gu) ?? []).length >= minWords)
    .map((s) => ({ sentence: s, ...detectLanguage(s) }))
    .filter((r) => r.lang !== "unknown" && r.lang !== expected);
}
