import {getDraftId, getPublishedId, isDraftId} from 'sanity'
import {ref, weakRef} from './helpers.ts'

// ─── Persons ────────────────────────────────────────────────────────────────

export const personBriefs = [
  {
    _id: 'person-elena-vasquez',
    name: 'Elena Vasquez',
    prompt: {
      role: 'VP of Product Marketing at a global SaaS company. Writes about product launches, market expansion, and localization strategy. Previously led international growth at two unicorn startups.',
    },
  },
  {
    _id: 'person-james-okafor',
    name: 'James Okafor',
    prompt: {
      role: 'Content Strategist specializing in enterprise content operations. Writes about content architecture, editorial workflows, and scaling content across markets. Background in journalism and technical writing.',
    },
  },
  {
    _id: 'person-mei-tanaka',
    name: 'Mei Tanaka',
    prompt: {
      role: 'Head of International at a design tools company. Writes about design systems, brand consistency across cultures, and creative localization. Former UX researcher with experience across APAC markets.',
    },
  },
  {
    _id: 'person-sofia-andersson',
    name: 'Sofia Andersson',
    prompt: {
      role: 'Localization Engineer at a developer tools company. Writes about translation pipelines, quality evaluation, and the intersection of structured content and machine translation. Background in computational linguistics and NLP.',
    },
  },
]

// ─── Editorial topics ───────────────────────────────────────────────────────

export const topicBriefs = [
  {
    _id: 'topic-product-launches',
    title: 'Product Launches',
    slug: 'product-launches',
    description: 'Strategies for launching products across multiple markets simultaneously.',
  },
  {
    _id: 'topic-brand-voice',
    title: 'Brand Voice',
    slug: 'brand-voice',
    description: 'Maintaining consistent brand identity while adapting for local audiences.',
  },
  {
    _id: 'topic-content-operations',
    title: 'Content Operations',
    slug: 'content-operations',
    description: 'Scaling editorial workflows, governance, and content infrastructure.',
  },
  {
    _id: 'topic-market-expansion',
    title: 'Market Expansion',
    slug: 'market-expansion',
    description: 'Entering new geographic markets with localized content and campaigns.',
  },
]

// ─── Tags ───────────────────────────────────────────────────────────────────

export const tagBriefs = [
  {_id: 'tag-localization', title: 'Localization', slug: 'localization'},
  {_id: 'tag-marketing', title: 'Marketing', slug: 'marketing'},
  {_id: 'tag-product', title: 'Product', slug: 'product'},
  {_id: 'tag-strategy', title: 'Strategy', slug: 'strategy'},
  {_id: 'tag-design', title: 'Design', slug: 'design'},
  {_id: 'tag-ai', title: 'AI', slug: 'ai'},
]

// ─── Articles (en-US source) ────────────────────────────────────────────────
// Each article may include a `translations` map specifying which locales to
// generate translations for. Locale codes are validated against the dataset
// at generation time. If a locale doesn't exist, that translation is skipped.
// Set `isDraft: true` to generate as an in-progress draft.

export const articleBriefs = [
  {
    _id: 'article-simultaneous-global-launch',
    author: ref('person-elena-vasquez'),
    topics: [ref('topic-product-launches'), ref('topic-market-expansion')],
    tags: [ref('tag-localization'), ref('tag-product'), ref('tag-strategy')],
    language: 'en-US',
    translations: {
      'de-DE': {},
      'fr-FR': {},
      'ja-JP': {isDraft: true},
    },
    prompt: {
      topic: 'How to run a simultaneous product launch across 12 markets',
      contentGuidance: `Write a detailed, practical article about coordinating a global product launch where all markets go live within the same 24-hour window. Cover the coordination challenges: timezone handoffs, translation pipelines, regulatory review in different jurisdictions, asset localization (screenshots, videos, UI strings), and the role of structured content in making this possible. Include specific examples like adapting a product name that works in English but has unfortunate connotations in another language. The tone should be confident and experienced. Someone who has done this multiple times and learned from mistakes. Eight to twelve paragraphs with section headings.`,
    },
  },
  {
    _id: 'article-glossaries-drive-consistency',
    author: ref('person-james-okafor'),
    topics: [ref('topic-content-operations'), ref('topic-brand-voice')],
    tags: [ref('tag-localization'), ref('tag-strategy')],
    language: 'en-US',
    translations: {
      'de-DE': {},
      'fr-FR': {isDraft: true},
    },
    prompt: {
      topic: 'Why translation glossaries are your most underrated content asset',
      contentGuidance: `Write about how translation glossaries (approved terms, do-not-translate lists, forbidden terms) dramatically improve translation quality when used as structured metadata rather than static spreadsheets. Explain how a glossary entry that captures term, status, part of speech, gender, and usage context gives translation agents (human or AI) the information they need to make correct decisions. Use concrete examples: a product name that should never be translated, a technical term with an approved German translation and grammatical gender, a deprecated term that should be flagged. The article should make the case that glossaries are infrastructure, not documentation. Six to ten paragraphs.`,
    },
  },
  {
    _id: 'article-style-guides-by-locale',
    author: ref('person-mei-tanaka'),
    topics: [ref('topic-brand-voice'), ref('topic-market-expansion')],
    tags: [ref('tag-localization'), ref('tag-design'), ref('tag-strategy')],
    language: 'en-US',
    translations: {
      'ja-JP': {},
    },
    prompt: {
      topic: 'Designing locale-specific style guides that preserve brand identity',
      contentGuidance: `Write about creating per-locale style guides that capture formality level, tone, and audience-specific instructions. Cover how "professional" means different things in Germany (formal Sie, precise technical language) vs Japan (desu/masu form, respectful indirectness) vs Brazil (warm, approachable, informal). Discuss the tension between brand consistency and cultural adaptation. A brand that's "friendly and casual" in English needs to be "friendly and respectful" in Japanese. Include practical advice on what a good style guide document should contain: formality setting, tone adjectives, audience description, and additional instructions. Six to ten paragraphs with examples.`,
    },
  },
  {
    _id: 'article-ai-translation-context',
    author: ref('person-elena-vasquez'),
    topics: [ref('topic-content-operations')],
    tags: [ref('tag-ai'), ref('tag-localization'), ref('tag-product')],
    language: 'en-US',
    translations: {
      'de-DE': {isDraft: true},
    },
    prompt: {
      topic: 'Structured metadata makes AI translation agents actually useful',
      contentGuidance: `Write about the gap between raw AI translation and production-grade output, and how structured content metadata closes that gap. Cover three specific ways metadata improves output: (1) glossaries ensure approved terminology and prevent mistranslation of brand/product names, (2) style guides enforce the right register and tone per locale, (3) content-aware filtering means only relevant glossary terms are injected into each prompt. Contrast the "paste text into ChatGPT" approach with a structured pipeline where glossaries, style guides, and locale rules are assembled into agent prompts at translation time. The tone should be practical and slightly opinionated. This is written by someone who has seen both approaches and knows which one works. Eight to twelve paragraphs.`,
    },
  },
  {
    _id: 'article-content-reuse-across-markets',
    author: ref('person-james-okafor'),
    topics: [ref('topic-content-operations'), ref('topic-market-expansion')],
    tags: [ref('tag-marketing'), ref('tag-strategy')],
    language: 'en-US',
    prompt: {
      topic: 'The content reuse playbook for multi-market teams',
      contentGuidance: `Write about structuring content for maximum reuse across markets. Cover the difference between content that should be translated (product descriptions, help docs), content that should be transcreated (marketing campaigns, brand storytelling), and content that should be created locally (market-specific case studies, local regulations). Discuss how structured content models (separating content from presentation, using references instead of duplication) enable this. Include the organizational dimension: how to set up editorial workflows where local teams can adapt content without breaking the source. Six to ten paragraphs.`,
    },
  },
  {
    _id: 'article-seasonal-campaigns-global',
    author: ref('person-mei-tanaka'),
    topics: [ref('topic-product-launches'), ref('topic-brand-voice')],
    tags: [ref('tag-marketing'), ref('tag-design'), ref('tag-localization')],
    language: 'en-US',
    translations: {
      'fr-FR': {},
    },
    prompt: {
      topic: 'Running seasonal marketing campaigns across cultures',
      contentGuidance: `Write about the challenges and strategies for running seasonal or holiday campaigns across multiple markets. Cover how "Back to School" is August in the US but April in Japan, how Black Friday has different levels of cultural relevance, and how some holidays are market-specific (Singles Day in China, Diwali in India, Golden Week in Japan). Discuss the content operations challenge: preparing campaign assets months in advance, localizing not just text but visual design and messaging tone, and coordinating launch timing across timezones. Include a practical framework for planning a global seasonal content calendar. Six to ten paragraphs.`,
    },
  },
  {
    _id: 'article-translation-quality-evaluation',
    author: ref('person-sofia-andersson'),
    topics: [ref('topic-content-operations')],
    tags: [ref('tag-ai'), ref('tag-localization'), ref('tag-strategy')],
    language: 'en-US',
    prompt: {
      topic: 'Building evaluation frameworks that prove translation quality',
      contentGuidance: `Write about designing evaluation frameworks for translation quality that go beyond "does it sound right?" to measurable, repeatable metrics. Cover deterministic checks (glossary term presence, forbidden term absence, formality markers) and LLM-as-judge scoring across dimensions like fluency, accuracy, and style adherence. Explain how baseline comparisons (translating with and without structured context) quantify the value of glossaries and style guides. Include practical advice on setting up automated eval pipelines, choosing scoring rubrics, and interpreting results. Address the challenge of evaluating across languages when reviewers may not be fluent in all target locales. Eight to twelve paragraphs.`,
    },
  },
  {
    _id: getDraftId('article-structured-content-multichannel'),
    author: ref('person-james-okafor'),
    topics: [ref('topic-content-operations'), ref('topic-brand-voice')],
    tags: [ref('tag-product'), ref('tag-strategy')],
    language: 'en-US',
    prompt: {
      topic: 'Structured content as the foundation for multi-channel delivery',
      contentGuidance: `Write about why structured content (separating content from presentation) is the prerequisite for delivering consistent messaging across web, mobile, email, print, and emerging channels. Cover how rich text formats like Portable Text store content as structured data that can be rendered differently per channel. Discuss the organizational shift: content teams stop thinking in "pages" and start thinking in "content objects" that flow to wherever they're needed. Include examples of how a single product announcement can be rendered as a full blog post, a social media card, an email snippet, and an in-app notification, all from the same source document. Six to ten paragraphs.`,
    },
  },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

/** ISO string for `n` days before `base`. */
function daysAgo(base: Date, n: number): string {
  return new Date(base.getTime() - n * 86_400_000).toISOString()
}

/** Lookup map for article briefs by published ID. */
const source_briefs_by_id = new Map(articleBriefs.map((b) => [getPublishedId(b._id), b] as const))

// ─── Translation brief builders ─────────────────────────────────────────────
// Called by the generate script after fetching locales from the dataset.

/**
 * Build translated article briefs from source articles and dataset locales.
 * Only generates translations for locales that exist in the dataset.
 */
export function buildTranslationBriefs(locales: {code: string; title: string}[]) {
  const localesByCode = Object.fromEntries(locales.map((l) => [l.code, l]))

  const translatedBriefs: Array<Record<string, unknown>> = []
  const metadataBySource = new Map<
    string,
    {localeCode: string; baseId: string; documentId: string}[]
  >()

  for (const source of articleBriefs) {
    if (!source.translations) continue

    const sourcePublishedId = getPublishedId(source._id)
    const translationsForMeta: {localeCode: string; baseId: string; documentId: string}[] = []

    for (const [localeCode, opts] of Object.entries(source.translations)) {
      const locale = localesByCode[localeCode]
      if (!locale) {
        process.stderr.write(
          `  ⚠ skipping ${localeCode} for ${source._id} (locale not in dataset)\n`,
        )
        continue
      }

      const baseId = `${sourcePublishedId}-${localeCode.toLowerCase()}`
      const isDraft = opts.isDraft ?? false
      const documentId = isDraft ? getDraftId(baseId) : baseId

      translatedBriefs.push({
        _id: documentId,
        author: source.author,
        topics: source.topics,
        tags: source.tags,
        language: localeCode,
        prompt: {
          topic: `[${locale.title} translation] ${source.prompt.topic}`,
          contentGuidance: `Write this article entirely in ${locale.title}. The topic is the same as the English source:\n\n${source.prompt.topic}\n\n${source.prompt.contentGuidance}\n\nWrite naturally in ${locale.title}. Do not produce a word-for-word translation. Adapt idioms, examples, and cultural references for a ${locale.title}-speaking audience. Keep Sanity product names (Studio, Content Lake, GROQ, Portable Text, Perspectives, Releases) in English as they are brand names.`,
        },
      })

      translationsForMeta.push({localeCode, baseId, documentId})
    }

    if (translationsForMeta.length > 0) {
      metadataBySource.set(sourcePublishedId, translationsForMeta)
    }
  }

  // Build translation metadata documents with realistic workflow states
  const seedDate = new Date('2026-02-25T10:00:00Z')

  const translationMetadata = []
  for (const [sourceId, translations] of metadataBySource) {
    const workflowStates: Array<Record<string, unknown>> = []

    for (const t of translations) {
      const brief = source_briefs_by_id.get(sourceId)
      const translationOpts = brief?.translations?.[t.localeCode]
      const isDraft = translationOpts?.isDraft ?? false

      // Special case: article-simultaneous-global-launch ja-JP → stale demo
      if (sourceId === 'article-simultaneous-global-launch' && t.localeCode === 'ja-JP') {
        workflowStates.push({
          language: t.localeCode,
          status: 'stale',
          source: 'ai',
          updatedAt: daysAgo(seedDate, 1),
          staleSourceRev: 'seed-stale-rev-001',
        })
      } else if (isDraft) {
        workflowStates.push({
          language: t.localeCode,
          status: 'needsReview',
          source: 'ai',
          updatedAt: daysAgo(seedDate, 1 + Math.random()),
        })
      } else {
        workflowStates.push({
          language: t.localeCode,
          status: 'approved',
          source: 'ai',
          updatedAt: daysAgo(seedDate, 3 + Math.random() * 4),
          reviewedBy: 'person-mei-tanaka',
        })
      }
    }

    // Build staleAnalysis cache for the stale demo article
    const staleAnalysis =
      sourceId === 'article-simultaneous-global-launch'
        ? {
            sourceRevision: 'seed-stale-rev-001',
            analyzedAt: daysAgo(seedDate, 0.5),
            result: {
              explanation:
                'The introduction paragraph was reworded for clarity and a new sentence was added about regulatory timelines. These are cosmetic changes that do not alter the core advice.',
              materiality: 'cosmetic' as const,
              suggestions: [
                {
                  fieldName: 'body',
                  explanation:
                    'Introduction reworded for flow; no factual changes. A sentence about regulatory lead times was added.',
                  recommendation: 'dismiss' as const,
                  changeSummary: 'Introduction reworded, regulatory sentence added',
                  reasonCode: 'tone_only' as const,
                  impactTags: ['Wording improved'],
                },
                {
                  fieldName: 'excerpt',
                  explanation: 'Minor punctuation change — an em-dash was replaced with a comma.',
                  recommendation: 'dismiss' as const,
                  changeSummary: 'Punctuation fix in excerpt',
                  reasonCode: 'formatting_only' as const,
                  impactTags: ['Formatting only'],
                },
              ],
            },
            // preTranslations are populated at runtime by analyze-stale-translations.
            // Omitted from seed data because suggestedValue is polymorphic (string | PT blocks)
            // and not representable in the Sanity schema.
            preTranslations: [],
          }
        : undefined

    translationMetadata.push({
      _id: `translation.metadata.${sourceId}`,
      _type: 'translation.metadata',
      translations: [
        {language: 'en-US', value: ref(sourceId)},
        ...translations.map((t) => ({
          language: t.localeCode,
          value: isDraftId(t.documentId) ? weakRef(t.baseId, 'article') : ref(t.baseId),
        })),
      ],
      schemaTypes: ['article'],
      workflowStates,
      ...(staleAnalysis && {staleAnalysis}),
    })
  }

  return {translatedBriefs, translationMetadata}
}
