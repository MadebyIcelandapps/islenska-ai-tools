# Research: what already exists for Icelandic, and what this repo adds

Read on 2026-10-24 (pages fetched that day; links below). The rule for this repo:
we add what is missing, we never copy, and we respect every licence.

## What exists

| Who | What | Licence | Source |
| --- | --- | --- | --- |
| Miðeind | **GreynirEngine** (Python package `reynir`): parser for Icelandic, sentence trees, lemmas, case and inflection | MIT | https://github.com/mideind/GreynirEngine (the old GreynirPackage address now leads here) |
| Miðeind | **Tokenizer**: splits Icelandic text into sentences and tokens (dates, amounts, abbreviations) | MIT | https://github.com/mideind/Tokenizer |
| Miðeind | **GreynirCorrect** (`reynir-correct`): spelling and grammar correction for Icelandic | MIT (code). It "indirectly embeds" BÍN and uses Ritmyndir, a set of non-standard word forms | https://github.com/mideind/GreynirCorrect |
| Miðeind | **BinPackage** (`islenska`): BÍN as a Python package, look up and inflect any word | MIT (code); the BÍN data inside it stays CC BY-SA 4.0 | https://github.com/mideind/BinPackage |
| Miðeind | Icelandic eval sets on Hugging Face: icelandic-winogrande, icelandic-arc-challenge, icelandic_qa_scandeval, icelandic_wiki_qa, icelandic-inflection-easy and -all-flat, gec-test-set, translation sets; and the **Icelandic LLM Leaderboard** | per dataset (see each card) | https://huggingface.co/mideind , https://huggingface.co/spaces/mideind/icelandic-llm-leaderboard |
| Miðeind | IceBERT models, an Icelandic speech recogniser and more. Their org page says most of their software is GPLv3 or MIT | GPLv3 or MIT | https://huggingface.co/mideind |
| Árni Magnússon Institute | **BÍN / DIM** (Beygingarlýsing íslensks nútímamáls, Database of Icelandic Morphology): over 7.4 million entries, about 356,000 lemmas, chief editor Kristín Bjarnadóttir | **CC BY-SA 4.0**, with credit to the Institute and no claim of endorsement (as quoted by BinPackage) | https://bin.arnastofnun.is/ , terms: https://bin.arnastofnun.is/DMII/LTdata/conditions/ (English), https://bin.arnastofnun.is/gogn/mimisbrunnur/ (Icelandic) |
| Almannarómur | Centre for language technology and AI since 2014. Ran Máltækniáætlun 1 (2019 to 2022), which produced open building blocks for speech recognition, speech synthesis, machine translation, proofing and language resources. Máltækniáætlun 2 goes on with data collection and **testing how well language models handle Icelandic**. Gives Skerfur grants for putting Icelandic language technology to use | various | https://almannaromur.is/ |
| CLARIN-IS | Repository of Icelandic language resources (tagged and lemmatised corpora, machine translation, parsing and more), each item with its own licence | per item | https://repository.clarin.is/repository/xmlui/ |

Notes on the reading:
- The BÍN terms page is a JavaScript app and gave no text to our fetcher (plain request and headless Chrome both). The CC BY-SA 4.0 licence and the credit wording are quoted from the BinPackage README, which links to that page. Read the page itself in a browser before publishing.
- The leaderboard page could not be rendered at the time (server busy), so the benchmark list above comes from the Miðeind dataset list.

## What is missing, and what we add

The existing tools are strong at **grammar** (parsing, inflection, spelling) and at **benchmarks of general knowledge and reasoning** in Icelandic. What a business needs when an AI writes to its own customers in Icelandic is narrower and is not covered:

1. **Product and brand names in the right case.** BÍN knows common words and many personal names, but not a new brand like "Vaki". GreynirCorrect does not know that "prófa Vaki" should be "prófa Vaka". We add a small checker: you give a name and its four forms (or a weak-noun pattern) and it flags the nominative after a word that governs another case (prepositions such as frá, til, um, and verbs such as prófa). No BÍN data is shipped. Anyone who wants the forms of an existing word can look them up in BÍN themselves.
2. **House-style and banned-phrase rules for natural Icelandic product copy.** A configurable list (JSON) with reasons, scopes (all text or product copy only), an allow marker, and safe rewrites. Grammar checkers do not do this, because these rules are about tone and brand, not about errors.
3. **Answer evals for a customer-facing assistant in Icelandic**: the reply is in Icelandic when the guest wrote Icelandic (also when typed without Icelandic letters), every number in the reply can be traced to the facts given, the reply hands over to a person when the facts do not cover the question, no VAT talk in prices, no banned words, names declined right. The existing sets measure what a model knows; ours measure whether a reply is fit to send to a customer. They run on saved replies, so no model call is needed.

## What we do NOT do

- We do not ship BÍN data, Ritmyndir, or any part of Miðeind's code or data. We link to them.
- No eval example comes from a real customer, guest, email, company file or phone call. Every example is written from scratch for this repo.
- We do not claim to be a grammar checker. For grammar, use GreynirCorrect.
