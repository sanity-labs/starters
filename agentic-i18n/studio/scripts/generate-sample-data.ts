/**
 * Sample Data Generator
 *
 * Uses Sanity Agent Actions (client.agent.action.generate) to create
 * branded marketing editorial content for the starter template.
 *
 * Usage:
 *   pnpm generate-sample-data
 *
 * Then import:
 *   pnpm import-sample-data
 *
 * Requires:
 *   - `sanity login` (uses your Sanity auth session)
 *   - Locale documents must be seeded first (`pnpm seed`)
 */

import {execFileSync} from 'node:child_process'
import {createWriteStream} from 'node:fs'
import {parseArgs} from 'node:util'
import {getCliClient} from 'sanity/cli'
import {
  personBriefs,
  topicBriefs,
  tagBriefs,
  articleBriefs,
  buildTranslationBriefs,
} from './seed/briefs.ts'
import {glossaryDocument, styleGuideDocuments} from './seed/metadata.ts'

// ─── CLI ────────────────────────────────────────────────────────────────────

const {values: flags} = parseArgs({
  options: {
    out: {type: 'string', default: 'sample-data.ndjson'},
    concurrency: {type: 'string', default: '3'},
    workspace: {type: 'string', default: 'default'},
    'no-validate': {type: 'boolean', default: false},
  },
  strict: false,
  allowPositionals: true,
})

const OUT_FILE = flags.out!
const CONCURRENCY = parseInt(flags.concurrency!, 10)
const SKIP_VALIDATE = flags['no-validate']!
const SCHEMA_ID = `_.schemas.${flags.workspace}`

// ─── Sanity client ──────────────────────────────────────────────────────────
// getCliClient resolves project/dataset from sanity.cli.ts and injects the
// user token when run via `sanity exec --with-user-token`.

const client = getCliClient({apiVersion: 'vX'})

const SOURCE_LOCALE = 'en-US'

const TONE = `Write like a senior practitioner sharing hard-won experience. Use concrete examples, specific details, and real-world scenarios. The content should feel like it belongs on a high-quality marketing/strategy blog.`

// ─── Generate with retry ────────────────────────────────────────────────────

async function generate(params: Record<string, unknown>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await client.agent.action.generate({schemaId: SCHEMA_ID, noWrite: true, ...params})
    } catch (err: unknown) {
      if (attempt === 2) throw err
      process.stderr.write(`  ⟳ retry ${attempt + 1}: ${(err as Error).message}\n`)
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
    }
  }
}

// ─── Concurrent article generation ──────────────────────────────────────────

interface Brief {
  _id: string
  author?: unknown
  topics?: unknown[]
  tags?: unknown[]
  language: string
  prompt: {topic: string; contentGuidance: string}
}

async function generateArticles(briefs: Brief[], label: string) {
  process.stderr.write(`⏳ ${briefs.length} ${label}...\n`)
  let done = 0
  const inflight = new Set<Promise<void>>()
  const results: (Record<string, unknown> | null)[] = []
  let nextIndex = 0

  function startNext() {
    if (nextIndex >= briefs.length) return
    const i = nextIndex++
    const brief = briefs[i]
    const p = generate({
      targetDocument: {operation: 'create', _type: 'article'},
      instruction: `${brief.prompt.topic}\n\n${brief.prompt.contentGuidance}\n\n${TONE}`,
      target: {include: ['title', 'slug', 'excerpt', 'body', 'publishedAt']},
    })
      .then((doc) => {
        results[i] = {
          ...doc,
          _id: brief._id,
          language: brief.language,
          author: brief.author,
          topics: brief.topics,
          tags: brief.tags,
        }
        done++
        process.stderr.write(
          `  [${done}/${briefs.length}] ${(results[i] as Record<string, unknown>).title}\n`,
        )
      })
      .catch((err: Error) => {
        process.stderr.write(`  ✗ ${brief._id}: ${err.message}\n`)
        results[i] = null
      })
      .finally(() => {
        inflight.delete(p)
        startNext()
      })
    inflight.add(p)
  }

  for (let i = 0; i < Math.min(CONCURRENCY, briefs.length); i++) startNext()
  while (inflight.size > 0) await Promise.race(inflight)

  const generated = results.filter(Boolean)
  process.stderr.write(`✓ ${generated.length} ${label}\n`)
  return generated
}

// ─── Async generator: yields documents as they're ready ─────────────────────

async function* generateDocuments() {
  // 0. Fetch locales from dataset (must be seeded first)
  const locales = await client.fetch<{code: string; title: string}[]>(
    `*[_type == "l10n.locale"]{ code, title }`,
  )
  const targetLocales = locales.filter((l) => l.code !== SOURCE_LOCALE)
  process.stderr.write(
    `→ ${locales.length} locales in dataset (${targetLocales.length} target)\n\n`,
  )

  if (targetLocales.length === 0) {
    process.stderr.write(
      `⚠ No target locales found. Run \`pnpm seed\` first to create locale documents.\n`,
    )
  }

  // Build translated briefs from dataset locales
  const {translatedBriefs, translationMetadata} = buildTranslationBriefs(targetLocales)

  // 1. Translation metadata — static
  yield glossaryDocument
  for (const sg of styleGuideDocuments) yield sg
  process.stderr.write(`✓ 1 glossary, ${styleGuideDocuments.length} style guides\n`)

  // 2. Topics and tags — static, no API call needed
  for (const topic of topicBriefs) {
    yield {
      _id: topic._id,
      _type: 'editorialTopic',
      title: topic.title,
      slug: {_type: 'slug', current: topic.slug},
      description: topic.description,
    }
  }
  process.stderr.write(`✓ ${topicBriefs.length} editorial topics\n`)

  for (const tag of tagBriefs) {
    yield {
      _id: tag._id,
      _type: 'tag',
      title: tag.title,
      slug: {_type: 'slug', current: tag.slug},
    }
  }
  process.stderr.write(`✓ ${tagBriefs.length} tags\n`)

  // 3. Translation metadata — links source ↔ translated articles
  for (const meta of translationMetadata) yield meta
  process.stderr.write(`✓ ${translationMetadata.length} translation metadata\n`)

  // 4. Persons — AI generates bio
  process.stderr.write(`⏳ ${personBriefs.length} persons...\n`)
  for (const brief of personBriefs) {
    try {
      const doc = await generate({
        targetDocument: {operation: 'create', _type: 'person'},
        instruction: `Create a profile for ${brief.name}. ${brief.prompt.role}\n\nWrite a 2-3 sentence professional bio.`,
        target: {include: ['name', 'bio']},
      })
      yield {...doc, _id: brief._id}
      process.stderr.write(`  ✓ ${brief.name}\n`)
    } catch (err: unknown) {
      process.stderr.write(`  ✗ ${brief.name}: ${(err as Error).message}\n`)
    }
  }

  // 5. en-US source articles — AI generates title, excerpt, body
  const sourceArticles = await generateArticles(articleBriefs as Brief[], 'en-US articles')
  for (const article of sourceArticles) yield article

  // 6. Translated articles — AI generates content in target locale
  if (translatedBriefs.length > 0) {
    const translatedArticles = await generateArticles(
      translatedBriefs as Brief[],
      'translated articles',
    )
    for (const article of translatedArticles) yield article
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const {projectId, dataset} = client.config()
  process.stderr.write(
    `→ Project: ${projectId}\n→ Dataset: ${dataset}\n→ Concurrency: ${CONCURRENCY}\n→ Output: ${OUT_FILE}\n\n`,
  )

  const out = createWriteStream(OUT_FILE)
  let total = 0

  for await (const doc of generateDocuments()) {
    out.write(JSON.stringify(doc) + '\n')
    total++
  }

  await new Promise<void>((resolve, reject) =>
    out.end((err?: Error) => (err ? reject(err) : resolve())),
  )
  process.stderr.write(`\n✓ Wrote ${total} documents to ${OUT_FILE}\n`)

  // Validate generated documents against the workspace schema
  if (SKIP_VALIDATE) {
    process.stderr.write(`\n⏭ Skipping validation (--no-validate)\n`)
  } else {
    process.stderr.write(`\n⏳ Validating ${OUT_FILE}...\n`)
    try {
      execFileSync(
        'pnpm',
        ['exec', 'sanity', 'documents', 'validate', '--file', OUT_FILE, '--yes'],
        {
          stdio: 'inherit',
        },
      )
      process.stderr.write(`✓ Validation passed\n`)
    } catch {
      process.stderr.write(
        `\n⚠ Validation reported errors above.\n` +
          `  "must be published" errors on translation metadata are expected for draft translations using weak references.\n`,
      )
    }
  }
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n${err.stack}\n`)
  process.exit(1)
})
