import type {Metadata} from 'next'
import Link from 'next/link'
import {DEFAULT_LANGUAGE} from '@/sanity/queries'

export const metadata: Metadata = {
  title: 'How It Works — L10n Starter',
  description:
    'Architecture overview: how this starter implements document-level localization with Sanity, Next.js path-based i18n routing, and AI-powered translation.',
}

/* ------------------------------------------------------------------ */
/*  Reusable UI primitives (scoped to this page)                      */
/* ------------------------------------------------------------------ */

function SectionHeading({id, children}: {id: string; children: React.ReactNode}) {
  return (
    <h2 id={id} className="text-2xl font-semibold mt-16 mb-4 scroll-mt-24">
      {children}
    </h2>
  )
}

function Card({children, className = ''}: {children: React.ReactNode; className?: string}) {
  return (
    <div
      className={`rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] backdrop-blur-xl p-5 ${className}`}
    >
      {children}
    </div>
  )
}

function highlightCode(code: string): React.ReactNode[] {
  // Lightweight syntax highlighting via regex — covers JS/TS/GROQ tokens
  const tokenPattern =
    /(\/\/[^\n]*|'[^']*'|"[^"]*"|`[^`]*`|\b(?:const|let|var|function|import|export|from|type|return|if|else|async|await|new|null|true|false|undefined)\b|\b(?:defineField|defineQuery|createL10n|order|desc|asc)\b|\b\d+\b|\$\w+|_type|_id|_ref|_key|\*\[)/g

  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenPattern.exec(code)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      parts.push(code.slice(lastIndex, match.index))
    }

    const token = match[0]
    let className: string

    if (token.startsWith('//')) {
      className = 'text-[var(--color-text-muted)] italic'
    } else if (token.startsWith("'") || token.startsWith('"') || token.startsWith('`')) {
      className = 'text-emerald-600'
    } else if (
      /^(const|let|var|function|import|export|from|type|return|if|else|async|await|new)$/.test(
        token,
      )
    ) {
      className = 'text-purple-600'
    } else if (/^(null|true|false|undefined)$/.test(token)) {
      className = 'text-amber-600'
    } else if (/^(defineField|defineQuery|createL10n|order|desc|asc)$/.test(token)) {
      className = 'text-[var(--color-accent)]'
    } else if (/^\d+$/.test(token)) {
      className = 'text-amber-600'
    } else if (token.startsWith('$') || token.startsWith('_')) {
      className = 'text-rose-600'
    } else if (token === '*[') {
      className = 'text-[var(--color-accent)] font-semibold'
    } else {
      className = ''
    }

    parts.push(
      <span key={match.index} className={className}>
        {token}
      </span>,
    )
    lastIndex = match.index + token.length
  }

  if (lastIndex < code.length) {
    parts.push(code.slice(lastIndex))
  }

  return parts
}

function CodeBlock({title, children}: {title?: string; children: string}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] backdrop-blur-xl overflow-hidden my-6">
      {title && (
        <div className="px-4 py-2 border-b border-[var(--color-border)] text-xs font-medium text-[var(--color-text-secondary)]">
          {title}
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
        <code>{highlightCode(children)}</code>
      </pre>
    </div>
  )
}

function Badge({children}: {children: React.ReactNode}) {
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--color-accent-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-accent)]">
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function ArchitecturePage({params}: {params: Promise<{lang: string}>}) {
  const {lang} = await params

  return (
    <div className="pb-20">
      {/* Back link */}
      <Link
        href={`/${lang}`}
        className="group inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-[color] duration-[var(--transition-fast)] mb-10"
      >
        <span className="transition-transform duration-[var(--transition-fast)] group-hover:-translate-x-0.5">
          &larr;
        </span>
        Homepage
      </Link>

      {lang !== DEFAULT_LANGUAGE && (
        <div className="rounded-[var(--radius-md)] border-l-2 border-l-[var(--color-accent)] bg-[var(--color-accent-subtle)] backdrop-blur-xl px-4 py-3 mb-6 text-sm text-[var(--color-text-secondary)]">
          This page is only available in English.
        </div>
      )}

      {/* Hero */}
      <header className="mb-14">
        <Badge>Architecture</Badge>
        <h1 className="text-4xl font-bold tracking-tight mt-3 leading-tight">
          How this localization system works
        </h1>
        <p className="mt-4 text-lg text-[var(--color-text-secondary)] leading-relaxed max-w-2xl">
          A technical walkthrough of the patterns behind this starter: document-level localization
          in Sanity, path-based i18n routing in Next.js, and AI-powered translation with glossary
          and style guide support.
        </p>
      </header>

      {/* Quick nav */}
      <Card className="mb-14">
        <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">On this page</p>
        <nav className="flex flex-wrap gap-2">
          {[
            ['#content-model', 'Content model'],
            ['#routing', 'i18n routing'],
            ['#querying', 'Querying by locale'],
            ['#fallback', 'Fallback strategy'],
            ['#translation', 'AI translation'],
            ['#architecture-diagram', 'System diagram'],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-full border border-[var(--color-border)] px-3 py-1 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/20 hover:text-[var(--color-accent)] transition-all duration-[var(--transition-fast)]"
            >
              {label}
            </a>
          ))}
        </nav>
      </Card>

      {/* ------------------------------------------------------------ */}
      {/* Content model                                                 */}
      {/* ------------------------------------------------------------ */}
      <SectionHeading id="content-model">Document-level localization in Sanity</SectionHeading>

      <p className="text-[var(--color-text-secondary)] leading-relaxed mb-6">
        This starter uses <strong>document-level</strong> localization: each translation is a
        separate Sanity document with its own{' '}
        <code className="text-sm bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
          _id
        </code>
        . An English article and its German translation are two distinct documents linked by a
        shared{' '}
        <code className="text-sm bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
          translation.metadata
        </code>{' '}
        record.
      </p>

      <p className="text-[var(--color-text-secondary)] leading-relaxed mb-6">
        The alternative — field-level localization, where every field stores an object of
        locale&rarr;value pairs — works for small amounts of translatable content but breaks down at
        scale. Document-level keeps each translation independently publishable, reviewable, and
        versionable.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <Card>
          <p className="text-sm font-medium mb-2">
            Each document gets a{' '}
            <code className="text-xs bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
              language
            </code>{' '}
            field
          </p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            The l10n plugin injects a hidden, read-only{' '}
            <code className="text-xs bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
              language
            </code>{' '}
            string field (BCP-47 code like{' '}
            <code className="text-xs bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
              en-US
            </code>
            ) into every localized document type. Editors never see it; queries filter on it.
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium mb-2">Locales are content, not config</p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Each locale is an{' '}
            <code className="text-xs bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
              l10n.locale
            </code>{' '}
            document with code, title, native name, text direction, and fallback chain. Adding a new
            language is creating a document, not changing code.
          </p>
        </Card>
      </div>

      <CodeBlock title="How the plugin is configured — sanity.config.ts">
        {`const l10n = createL10n({
  localizedSchemaTypes: ['article'],
  // That's it. The plugin handles:
  // - Injecting the \`language\` field into 'article' schemas
  // - Registering l10n.locale, l10n.glossary, l10n.styleGuide types
  // - Connecting to @sanity/document-internationalization
})`}
      </CodeBlock>

      {/* ------------------------------------------------------------ */}
      {/* Routing                                                       */}
      {/* ------------------------------------------------------------ */}
      <SectionHeading id="routing">Path-based i18n routing in Next.js</SectionHeading>

      <p className="text-[var(--color-text-secondary)] leading-relaxed mb-6">
        This frontend follows the{' '}
        <a
          href="https://nextjs.org/docs/app/guides/internationalization"
          className="text-[var(--color-accent)] underline underline-offset-2 hover:text-[var(--color-accent-hover)] transition-[color] duration-[var(--transition-fast)]"
          target="_blank"
          rel="noopener noreferrer"
        >
          official Next.js i18n pattern
        </a>
        : locale as a path prefix, not a query parameter.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <Card>
          <p className="text-sm font-medium text-green-700 mb-1">Best practice</p>
          <code className="text-sm">/en-US/getting-started</code>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Unique URL per locale, SEO-friendly, CDN-cacheable
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-amber-700 mb-1">Avoid</p>
          <code className="text-sm">/getting-started?lang=en-US</code>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Query params ignored by many crawlers, not cacheable
          </p>
        </Card>
      </div>

      <p className="text-[var(--color-text-secondary)] leading-relaxed mb-4">
        Three pieces make this work:
      </p>

      <div className="space-y-3 mb-6">
        <Card>
          <p className="text-sm">
            <strong>1. Middleware</strong> — Redirects bare paths (
            <code className="text-xs bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
              /
            </code>
            ) to the default locale (
            <code className="text-xs bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
              /en-US
            </code>
            ). A simple regex check on the first path segment.
          </p>
        </Card>
        <Card>
          <p className="text-sm">
            <strong>
              2.{' '}
              <code className="text-xs bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
                app/[lang]/
              </code>{' '}
              segment
            </strong>{' '}
            — All pages live under a dynamic{' '}
            <code className="text-xs bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
              [lang]
            </code>{' '}
            directory. The layout sets{' '}
            <code className="text-xs bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
              &lt;html lang=&#123;lang&#125;&gt;
            </code>{' '}
            and fetches locales for the switcher.
          </p>
        </Card>
        <Card>
          <p className="text-sm">
            <strong>
              3.{' '}
              <code className="text-xs bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
                generateStaticParams
              </code>
            </strong>{' '}
            — The layout exports all locale codes, enabling Next.js to statically generate pages per
            locale at build time.
          </p>
        </Card>
      </div>

      <CodeBlock title="File structure">
        {`src/
├── middleware.ts              # / → /{preferred locale} redirect
└── app/
    └── [lang]/
        ├── layout.tsx         # <html lang={lang}>, locale switcher
        ├── page.tsx           # Article list for this locale
        ├── architecture/
        │   └── page.tsx       # This page
        └── [slug]/
            └── page.tsx       # Article detail + fallback`}
      </CodeBlock>

      {/* ------------------------------------------------------------ */}
      {/* Querying                                                      */}
      {/* ------------------------------------------------------------ */}
      <SectionHeading id="querying">Querying content by locale</SectionHeading>

      <p className="text-[var(--color-text-secondary)] leading-relaxed mb-6">
        Every GROQ query includes a{' '}
        <code className="text-sm bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
          language == $language
        </code>{' '}
        filter. The locale value comes from the URL path parameter. When a user switches locale, a{' '}
        <code className="text-sm bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
          NEXT_LOCALE
        </code>{' '}
        cookie is set so the middleware can redirect returning visitors to their preferred language.
      </p>

      <CodeBlock title="Fetching articles for a locale — queries.ts">
        {`// All articles for a locale
*[_type == "article" && language == $language]
  | order(publishedAt desc) {
    _id, title, "slug": slug.current,
    excerpt, publishedAt, language
  }

// Single article by slug + locale
*[_type == "article"
  && slug.current == $slug
  && language == $language][0] {
    _id, title, body, "author": author->{ name }
  }`}
      </CodeBlock>

      <p className="text-[var(--color-text-secondary)] leading-relaxed mb-6">
        The locale switcher dynamically populates from Sanity — no hardcoded locale list in the
        frontend:
      </p>

      <CodeBlock title="Fetching available locales">
        {`*[_type == "l10n.locale"] | order(title asc) {
  code,       // "en-US", "de-DE", etc.
  title,      // "English (United States)"
  nativeName  // "English"
}`}
      </CodeBlock>

      {/* ------------------------------------------------------------ */}
      {/* Fallback                                                      */}
      {/* ------------------------------------------------------------ */}
      <SectionHeading id="fallback">Fallback content strategy</SectionHeading>

      <p className="text-[var(--color-text-secondary)] leading-relaxed mb-6">
        When a user visits an article that hasn&apos;t been translated yet, the app doesn&apos;t
        show a 404. Instead, it falls back to the default language and tells the user what happened.
      </p>

      <Card className="mb-6">
        <div className="space-y-3 text-sm">
          <p>
            <strong>Step 1:</strong> Query for the article in the requested locale.
          </p>
          <p>
            <strong>Step 2:</strong> If null and locale is not the default, re-query with{' '}
            <code className="text-xs bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
              language == &quot;en-US&quot;
            </code>
            .
          </p>
          <p>
            <strong>Step 3:</strong> Render with a banner: &ldquo;This article is not yet available
            in [locale]. Showing the English version.&rdquo;
          </p>
          <p>
            <strong>Step 4:</strong> If still null, show 404.
          </p>
        </div>
      </Card>

      <h3 className="text-lg font-semibold mt-10 mb-4">How Sanity powers the fallback chain</h3>

      <p className="text-[var(--color-text-secondary)] leading-relaxed mb-6">
        The l10n plugin defines each locale as an{' '}
        <code className="text-sm bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
          l10n.locale
        </code>{' '}
        document in Sanity. Each locale document has a{' '}
        <code className="text-sm bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
          fallback
        </code>{' '}
        field — a <strong>reference to another locale document</strong>. This means fallback
        relationships are content you can edit in the Studio, not something hardcoded in application
        config.
      </p>

      <CodeBlock title="The fallback field on l10n.locale — translationLocale.tsx">
        {`defineField({
  name: 'fallback',
  title: 'Fallback Locale',
  type: 'reference',
  to: [{ type: 'l10n.locale' }],
  description:
    'If a translation is missing for this locale, '
    + 'the system will fall back to this locale',
})`}
      </CodeBlock>

      <p className="text-[var(--color-text-secondary)] leading-relaxed mb-6">
        Because each locale&apos;s fallback points to another locale document, you can build{' '}
        <strong>locale chains</strong>. A Portuguese (Brazil) locale references Portuguese
        (Portugal) as its fallback, which in turn references English. The chain resolves naturally:
      </p>

      <Card className="mb-6 font-mono text-sm">
        <p className="text-[var(--color-text-secondary)]">
          <code>pt-BR</code> &rarr; <code>pt-PT</code> &rarr; <code>en-US</code> &rarr;{' '}
          <span className="text-[var(--color-text-muted)]">(no fallback, show 404)</span>
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-2 font-sans">
          Each arrow is a document reference. Adding or changing fallback chains is a Studio edit —
          no code changes, no redeploy.
        </p>
      </Card>

      <p className="text-[var(--color-text-secondary)] leading-relaxed mb-6">
        This starter keeps things simple: the frontend falls back directly to{' '}
        <code className="text-sm bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
          en-US
        </code>{' '}
        in a single step. For production, you could resolve the full chain by fetching the locale
        document first, following its{' '}
        <code className="text-sm bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
          fallback
        </code>{' '}
        reference, and querying each locale in sequence until content is found.
      </p>

      {/* ------------------------------------------------------------ */}
      {/* AI Translation                                                */}
      {/* ------------------------------------------------------------ */}
      <SectionHeading id="translation">AI-powered translation</SectionHeading>

      <p className="text-[var(--color-text-secondary)] leading-relaxed mb-6">
        The Sanity Studio in this starter includes a translation workflow powered by Sanity&apos;s
        Agent Actions Translate API. This isn&apos;t generic machine translation — it&apos;s
        context-aware and brand-consistent.
      </p>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card>
          <p className="text-sm font-medium mb-1">Glossary</p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Terminology database with approved translations, &ldquo;do not translate&rdquo; terms,
            and forbidden terms. Only terms found in the source content are included in each
            translation request.
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium mb-1">Style guide</p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Per-locale brand voice: formality level, tone adjectives, and custom instructions. The
            German guide might say &ldquo;use formal Sie&rdquo; while Japanese specifies
            &ldquo;desu/masu form.&rdquo;
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium mb-1">Stale detection</p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            When the source document changes, translations are flagged as stale. AI analyzes what
            changed and suggests which fields need retranslation vs. which changes are cosmetic.
          </p>
        </Card>
      </div>

      <CodeBlock title="What the Translate API receives (assembled by promptAssembly.ts)">
        {`{
  schemaId: "article",
  documentId: "article-123",
  fromLanguage: "en-US",
  toLanguage: "de-DE",
  styleGuide: "## Glossary\\n- Content Lake → Content Lake (do not translate)\\n...",
  protectedPhrases: ["Sanity", "GROQ", "Portable Text"],
  targetDocument: { operation: "createOrReplace" }
}`}
      </CodeBlock>

      {/* ------------------------------------------------------------ */}
      {/* System Diagram                                                */}
      {/* ------------------------------------------------------------ */}
      <SectionHeading id="architecture-diagram">System diagram</SectionHeading>

      <p className="text-[var(--color-text-secondary)] leading-relaxed mb-6">
        Here&apos;s how the pieces fit together:
      </p>

      {/* — Sanity Studio layer — */}
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] backdrop-blur-xl p-5 mb-2">
        <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-4">
          Sanity Studio
        </p>

        {/* L10n document types */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-[var(--radius-sm)] border border-[var(--color-accent)]/15 bg-[var(--color-accent-subtle)] px-3 py-2">
            <p className="text-xs font-semibold text-[var(--color-accent)]">l10n.locale</p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">en-US, de-DE, ja-JP</p>
          </div>
          <div className="rounded-[var(--radius-sm)] border border-[var(--color-accent)]/15 bg-[var(--color-accent-subtle)] px-3 py-2">
            <p className="text-xs font-semibold text-[var(--color-accent)]">l10n.glossary</p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">terms + DNT list</p>
          </div>
          <div className="rounded-[var(--radius-sm)] border border-[var(--color-accent)]/15 bg-[var(--color-accent-subtle)] px-3 py-2">
            <p className="text-xs font-semibold text-[var(--color-accent)]">l10n.styleGuide</p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              per-locale brand voice
            </p>
          </div>
        </div>

        {/* Articles linked by translation.metadata */}
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white/40 px-4 py-3 mb-4">
          <div className="flex items-center justify-center gap-3 text-sm">
            <span className="font-mono text-xs text-[var(--color-text-secondary)]">
              article <span className="text-[var(--color-text-muted)]">(en-US)</span>
            </span>
            <span className="text-[var(--color-accent)] font-medium">&harr;</span>
            <span className="font-mono text-xs text-[var(--color-text-secondary)]">
              article <span className="text-[var(--color-text-muted)]">(de-DE)</span>
            </span>
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] text-center mt-1">
            linked via translation.metadata
          </p>
        </div>

        {/* Translate API */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-accent)] text-white px-3 py-1 text-xs font-medium">
            Translate API
          </span>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            glossary + style guide &rarr; AI translation
          </p>
        </div>
      </div>

      {/* — Connection arrow — */}
      <div className="flex flex-col items-center py-1 text-[var(--color-text-muted)]">
        <div className="w-px h-4 bg-[var(--color-border)]" />
        <span className="text-xs font-medium my-1">GROQ queries</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="size-4"
        >
          <path
            fillRule="evenodd"
            d="M10 3a.75.75 0 0 1 .75.75v10.19l3.72-3.72a.75.75 0 1 1 1.06 1.06l-5 5a.75.75 0 0 1-1.06 0l-5-5a.75.75 0 1 1 1.06-1.06l3.72 3.72V3.75A.75.75 0 0 1 10 3Z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {/* — Next.js Frontend layer — */}
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] backdrop-blur-xl p-5">
        <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-4">
          Next.js Frontend
        </p>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white/40 px-3 py-2">
            <p className="text-xs font-semibold text-[var(--color-text-primary)]">middleware</p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 font-mono">
              / &rarr; /&#123;locale&#125;
            </p>
          </div>
          <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white/40 px-3 py-2">
            <p className="text-xs font-semibold text-[var(--color-text-primary)]">/[lang]/</p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">layout + pages</p>
          </div>
          <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white/40 px-3 py-2">
            <p className="text-xs font-semibold text-[var(--color-text-primary)]">sanityFetch()</p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 font-mono">
              language == $lang
            </p>
          </div>
        </div>

        <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white/40 px-4 py-2.5 text-center">
          <p className="text-xs text-[var(--color-text-secondary)]">
            <span className="font-semibold text-[var(--color-text-primary)]">LocaleSwitcher</span>{' '}
            &mdash; reads locales from Sanity, swaps <span className="font-mono">/[lang]/</span>{' '}
            path segment
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* CTA                                                           */}
      {/* ------------------------------------------------------------ */}
      <div className="mt-16 rounded-[var(--radius-md)] border border-[var(--color-accent)]/20 bg-[var(--color-accent-subtle)] p-6">
        <h3 className="text-lg font-semibold mb-2">Add this to your project</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          This starter includes an agent skill that walks Claude through adding the full
          localization setup to any existing Sanity project. Studio-side and frontend-side, step by
          step.
        </p>
        <a
          href="https://github.com/sanity-labs/starters/tree/main/agentic-localization"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] text-white px-4 py-2 text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-[background-color] duration-[var(--transition-fast)]"
          target="_blank"
          rel="noopener noreferrer"
        >
          View on GitHub
        </a>
      </div>
    </div>
  )
}
