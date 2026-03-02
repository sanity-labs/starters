# What AI translation agents need to match enterprise quality

**Enterprise Translation Management Systems supply translators with rich, structured metadata — glossaries, style guides, visual context, quality frameworks, and governance controls — that dramatically improves output quality.** AI agents performing translation today, including Sanity's Agent Actions Translate, operate with a fraction of this context. Closing this gap requires understanding exactly what metadata fields, governance controls, and contextual signals TMS platforms provide and mapping those to prompt-level parameters an AI agent can consume. This report details the full landscape: what TMSs track, what professional translators need, what current AI tools support, and where Sanity's implementation fits.

---

## Enterprise TMSs track far more metadata than most AI tools consume

Translation Management Systems like SDL Trados, MemoQ, Phrase, Smartling, and Lokalise have converged on a shared architecture built around three core linguistic assets: **Translation Memory (TM)**, **termbases/glossaries**, and **style guides**, all governed by industry standards.

**Translation Memory** follows the TMX 1.4b standard, storing segment pairs with metadata per translation unit: source and target text, BCP-47 language codes, creator username, creation and modification timestamps, client name, domain, subdomain, project identifier, filename origin, and critically, **context** (previous/next segments or segment keys). MemoQ extends this with "double context" — both running text flow and document identifiers simultaneously — plus user-definable custom fields. Match types range from **101% context matches** (identical segment with identical surrounding context) down through exact (100%) and fuzzy (50–99%) matches, each carrying different confidence implications.

**Termbases** follow the TBX (ISO 30042:2019) standard with a three-level hierarchy: concept-level fields (subject field, definition, cross-references, images), language-level fields (locale-specific definitions), and term-level fields (part of speech, gender, usage status, administrative status, usage examples). The key governance-relevant statuses are **approved**, **forbidden**, **provisional**, and **non-standard**. Smartling adds a distinct **DNT (Do Not Translate) flag** for brand names and a separate **Blocklist** that hard-blocks translators from saving strings containing prohibited terms.

**Style guides** remain largely unstructured documents (PDFs or rich text) attached to projects, though Smartling bundles them into **Linguistic Packages** alongside glossaries and quality check profiles. Automated enforcement comes through QA word lists, regex patterns, terminology verifiers, and increasingly AI-powered tone/style checking. The gap between what style guides _contain_ and what systems can _enforce automatically_ remains significant.

Quality scoring follows the **MQM (Multidimensional Quality Metrics)** framework, now standardized as ISO DIS 5060:2024. MQM defines seven error dimensions — Terminology, Accuracy, Linguistic Conventions, Style, Locale Conventions, Audience Appropriateness, and Design/Markup — with severity weights of **1 (minor), 5 (major), and 25 (critical)**. A single critical error can trigger automatic failure. Smartling offers three built-in MQM schema templates; scores are calculated as weighted error penalties per word count against configurable pass/fail thresholds.

---

## Professional translators need three categories of context most AI agents lack

Industry research identifies three pillars of translation context, each containing metadata fields that directly influence output quality:

**Situational context** encompasses the content's purpose (marketing, legal, technical, UI string), target audience demographics, the platform or channel where text appears (web, mobile app, email, push notification), and project priority. Without this, translators — and AI models — default to generic register choices that often miss the mark. Research from RWS found that **85.6% of native speakers** report experiencing issues with inappropriate translations, with 62.4% agreeing cultural nuances are frequently disregarded.

**Communicative context** includes surrounding segments (paragraphs before and after), reference materials, brand voice specifications, formality level, domain expertise requirements, and previous translations for consistency. The absence of surrounding text is translators' most common complaint — isolated strings create "sentence salad" effects. DeepL's documentation illustrates this concretely: the German word "Tor" translates as "gate" or "goal" depending on context, and gendered forms (Lehrer vs. Lehrerin) require context about the subject's gender.

**Visual context** covers screenshots, in-context previews, character count limits, and design mockups. Lokalise's OCR-based screenshot tagging, Phrase's in-context HTML preview, and Crowdin's screenshot overlay all address the problem that the word "Home" could be a navigation button or a reference to a house. Over **70% of enterprise customers** at Transifex use character limit features, indicating this is a critical and common need.

The specific metadata fields that impact translation decisions form a comprehensive set: **source and target locale** (BCP-47, not just language — "color" vs. "colour" for en-US vs. en-GB), **content type** (marketing/legal/technical/UI), **domain** (healthcare/financial/automotive), **formality level** (formal/informal/casual), **audience demographics**, **platform constraints**, **brand voice descriptors** (3–5 personality adjectives), **register** (technical/conversational/academic), **SEO keywords per locale**, **date/number/currency formats**, **CLDR plural rules** (English has 2 forms, Arabic has 6, Chinese has 1), and **grammatical gender** per locale.

---

## Current AI translation APIs expose partial but growing context parameters

The four major translation APIs each handle context differently, revealing industry consensus on essential parameters while exposing gaps:

**DeepL** offers the richest context model among dedicated APIs. Its `context` parameter accepts surrounding text for disambiguation (explicitly not for instructions). Separate `formality` settings (`more`/`less`/`prefer_more`/`prefer_less`), `glossary_id` references with grammatical inflection (not simple search-and-replace), `style_id` for persistent formatting rules, and `custom_instructions` (up to 10 instructions of 300 characters each) cover different context needs. Tag handling parameters (`ignore_tags`, `non_splitting_tags`, `splitting_tags`) protect markup structure.

**Google Cloud Translation** takes a different approach with **Adaptive Translation**, combining LLMs with user-provided example sentence pairs (5–30,000 pairs) to teach style and terminology without model training. The `referenceSentenceConfig` allows up to 5 example pairs per request — effectively few-shot learning at the API level. Glossaries support unidirectional and equivalent term sets up to 10.4MB.

**Amazon Translate** uniquely offers a `Brevity` setting for reducing output length, `Formality` (`FORMAL`/`INFORMAL`), and strict **Custom Terminology** enforcement that forces specific translations regardless of context. Its `Profanity` setting masks offensive content with grawlix characters.

**Microsoft Translator** emphasizes custom model training via Custom Translator, with a `category` parameter linking to trained NMT models. Its inline `<mstrans:dictionary>` tags and `class=notranslate` HTML attribute provide protected-term mechanisms, though Microsoft recommends these "be used sparingly."

For LLM-based translation, research consistently shows that **prompt structure matters enormously**. The optimal pattern includes: role assignment ("You are a localization expert specializing in [domain]"), explicit task framing with source/target locale and audience, a glossary block with enforced terms, do-not-translate lists, style/tone instructions, and the source text. Few-shot examples from Translation Memory improve quality, with Smartling's RAG-based approach injecting only relevant glossary entries per segment to avoid context window pollution. The CJK Dictionary Institute's LRAG approach — automatically generating domain-specific glossaries and injecting relevant terms — reduced GPT-4 translation errors to **0%** for tested content with proper nouns.

Andrew Ng's translation-agent demonstrates that multi-step agentic approaches (translate → self-critique → improve) outperform single-pass translation, aligning with the multi-step review workflows enterprise TMSs have long employed.

---

## Sanity's Agent Actions Translate covers core parameters but lacks enterprise depth

Sanity offers two complementary translation systems: **Agent Actions Translate** (API/code-driven, experimental) and **AI Assist Translate** (Studio UI-driven, Growth plan+). Agent Actions Translate is the more powerful system, accepting these parameters:

- **`fromLanguage` / `toLanguage`**: Objects with `{id, title}` matching BCP-47 codes — the same pattern used across Sanity's i18n ecosystem
- **`styleGuide`**: Free-text instructions (max ~2,000 characters) supporting `$variable` syntax for dynamic injection, with four parameter types: `constant` (static strings), `field` (reads from document fields), `document` (passes full document contents), and `groq` (runs a GROQ query)
- **`protectedPhrases`**: String array of terms to preserve untranslated (e.g., `['Sanity', 'Media Library']`)
- **`target`**: Per-path field targeting with include/exclude, type filtering, and **per-path styleGuide overrides** — enabling different translation instructions for titles vs. body text
- **`temperature`**: Defaults to 0, favoring consistency over creativity
- **`targetDocument`**: Supports `create`, `edit`, `createIfNotExists`, `createOrReplace` operations
- **`languageFieldPath`**: Automatically sets the language field on the translated document
- **`async`** and **`noWrite`**: For background processing and preview modes

AI Assist Translate adds Studio-level integration with `@sanity/document-internationalization` and `sanity-plugin-internationalized-array`, supporting both document-level and field-level i18n strategies. Since v4.1.0, it supports **dynamic style guides** fetched from Sanity documents at translation time.

The `styleGuideParams` system is notably flexible: the `document` type can pass an entire glossary or style guide document's contents, while `groq` can query for locale-specific guidelines. This means a team could store structured translation metadata — glossaries, tone instructions, domain context, audience descriptions — as Sanity documents and inject them into translation prompts dynamically.

---

## The gap between TMS capabilities and AI agent context is specific and addressable

Mapping enterprise TMS features against what Sanity's Agent Actions Translate (and AI agents generally) support reveals a concrete set of gaps. Understanding these gaps clarifies what prompt-level context and metadata would need to be supplied to achieve comparable quality:

**What's already covered**: Source/target locale specification, protected phrases (DNT), free-text style instructions, per-field targeting, and the ability to inject external document content via `styleGuideParams`. These handle the basics well.

**What's missing or requires workarounds**:

- **Structured glossary/termbase**: TMSs maintain concept-oriented termbases with approved translations, forbidden terms, part-of-speech data, and usage status per term. Sanity's `protectedPhrases` only prevents translation (DNT) — it cannot enforce _specific_ translations for terms. A glossary would need to be embedded in the `styleGuide` text or injected via `styleGuideParams` referencing a glossary document. RAG-based injection of only relevant terms (as Smartling does) would prevent context window pollution.
- **Formality/register enum**: DeepL, Amazon, and Google all offer structured formality parameters. Sanity relies on free-text `styleGuide` instructions like "Use formal Sie form in German," which works but lacks the validation and consistency of an enumerated parameter.
- **Content type and domain signaling**: TMSs route content through different workflows based on type (legal, marketing, UI). An AI agent prompt benefits significantly from explicit content-type context — "This is a marketing headline" produces fundamentally different translations than "This is a legal disclaimer." This must currently be embedded in `styleGuide`.
- **Translation Memory / few-shot examples**: TMSs leverage previous translations for consistency. Without TM, each translation is independent. Injecting previous translations as few-shot examples via `styleGuideParams` (using GROQ queries to fetch related translated documents) could approximate this.
- **Prohibited terms (blocklist)**: Beyond DNT, enterprise TMSs maintain terms that must _never appear in output_ (competitor names, offensive terms). This would need to be specified in `styleGuide` text.
- **Automated QA validation**: TMSs run 15+ automated checks (placeholder integrity, number format, glossary compliance, character limits, tag consistency). Sanity has no built-in post-translation validation. A pipeline would need to add validation steps after `translate()` returns.
- **Quality scoring**: MQM-based scoring, LQA workflows, and pass/fail thresholds are absent. Sanity's documentation explicitly states that "AI Assist should never be relied on for critical content without human review."
- **Visual/UI context**: TMSs provide screenshots and in-context previews. AI agents receive text only. For UI strings, providing the component name, screen location, or character limit in the `styleGuide` would partially compensate.
- **Plural rules and gender handling**: CLDR-aware plural forms and grammatical gender agreement require locale-specific instructions that the AI model may handle implicitly but benefits from explicit guidance in prompts.

---

## Conclusion: building the context bridge

The essential insight is that **enterprise translation quality is not primarily a function of the translation engine — it's a function of the metadata ecosystem surrounding it**. TMSs have spent decades building structured metadata layers (TM, termbases, MQM, multi-step review) that give translators the context needed for accurate, consistent, brand-aligned output.

AI agents can match this quality, but only when their prompts carry equivalent context. Sanity's `styleGuide` + `styleGuideParams` system provides a flexible conduit for this context — the `document` and `groq` parameter types can inject entire glossary documents, style guides, or locale-specific instructions fetched from the CMS itself. The practical path forward involves storing translation metadata (glossaries, style guides, audience profiles, domain context) as structured Sanity documents and assembling them into translation prompts dynamically.

Three specific architectural patterns would close the largest gaps: first, a **structured glossary document type** with source terms, approved translations per locale, and forbidden terms, injected via `styleGuideParams` with RAG-style filtering for relevance; second, **post-translation validation functions** that check placeholder integrity, glossary compliance, and character limits before committing writes; and third, **locale-specific style guide documents** that encode formality, tone, audience, content-type context, and plural/gender guidance per target language, fetched dynamically at translation time. These patterns transform Sanity's flexible but unstructured translation parameters into a system that approximates the metadata richness enterprise TMSs have long provided.
