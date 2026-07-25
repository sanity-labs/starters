/**
 * Drift checks over the repo's prose, deterministic and model-free.
 *
 * A doc claim is checkable when it names something the tree either has or does
 * not: a path, a declared Function, an export, a version. Each check below is a
 * claim of that kind that went stale at least once.
 */

import {existsSync, readdirSync, readFileSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {describe, expect, test} from 'vitest'

import {REPO_ROOT} from './corpus'
import {codeSpanPaths, linkTargets, markdownFiles} from './docs'

/**
 * `e2e/.env` is gitignored — present on a configured machine, absent in CI, so
 * asserting either way is wrong.
 */
const UNRESOLVABLE_PATHS = new Set(['e2e/.env'])

/**
 * Path tokens a markdown file claims exist: repo-root-relative ones, plus
 * `src/...` when the file sits at the root of a workspace that has a `src/`.
 *
 * That second condition is what keeps the check honest about the skills, whose
 * `src/...` tokens are framework conventions rather than this tree — the
 * porting table's `src/pages/[lang]/` and `src/routes/[lang]/` are Astro's and
 * SvelteKit's, and no repo path can confirm or deny them.
 */
function pathClaims(file: {absolutePath: string; text: string}): string[] {
  if (!existsSync(resolve(dirname(file.absolutePath), 'src'))) return codeSpanPaths(file.text)

  const workspaceRelative = [...file.text.matchAll(/`([^`\n]+)`/g)]
    .map((match) => match[1].trim().replace(/[.,)]$/, ''))
    .filter((token) => token.startsWith('src/') && !/[*<>$\s]/.test(token))

  return [...codeSpanPaths(file.text), ...workspaceRelative]
}

describe('repo markdown', () => {
  test('every path it names exists', () => {
    const missing: string[] = []

    for (const file of markdownFiles) {
      const workspace = dirname(file.absolutePath)

      for (const token of pathClaims(file)) {
        if (UNRESOLVABLE_PATHS.has(token)) continue
        // Repo-root first, then the file's own directory: `apps/frontend/README.md`
        // names `src/sanity/queries.ts` relative to itself.
        const bases = [REPO_ROOT, workspace]
        if (!bases.some((base) => existsSync(resolve(base, token)))) {
          missing.push(`${file.path}: \`${token}\``)
        }
      }

      for (const target of linkTargets(file.text)) {
        if (!existsSync(resolve(workspace, target))) missing.push(`${file.path}: [](${target})`)
      }
    }

    expect(missing).toEqual([])
  })
})

/** `name: '<x>'` is the first property of every function resource. */
function declaredFunctions(blueprint: string): string[] {
  const uncommented = blueprint
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')

  return [
    ...uncommented.matchAll(/define(?:Document|Schedule)Function\(\{[^}]*?name:\s*'([^']+)'/g),
  ].map((match) => match[1])
}

describe('functions', () => {
  const declared = declaredFunctions(
    readFileSync(resolve(REPO_ROOT, 'sanity.blueprint.ts'), 'utf8'),
  )
  const built: string[] = [
    ...readFileSync(resolve(REPO_ROOT, 'functions/rolldown.config.ts'), 'utf8')
      .match(/const functions = \[([\s\S]*?)\]/)![1]
      .matchAll(/'([^']+)'/g),
  ].map((match) => match[1])
  const sources = readdirSync(resolve(REPO_ROOT, 'functions'), {withFileTypes: true})
    .filter(
      (entry) => entry.isDirectory() && entry.name !== 'dist' && entry.name !== 'node_modules',
    )
    .map((entry) => entry.name)

  // Pins the parser, not today's blueprint: a commented-out resource is
  // declared by nobody, and `heartbeat` ships exactly that way.
  test('the parse reads uncommented declarations only', () => {
    const sample = [
      "defineDocumentFunction({name: 'live'})",
      '// defineScheduleFunction({',
      "//   name: 'commented',",
      '// })',
      "/* defineDocumentFunction({name: 'blocked'}) */",
    ].join('\n')

    expect(declaredFunctions(sample)).toEqual(['live'])
  })

  test('every declared Function has a source directory', () => {
    expect(declared.length).toBeGreaterThan(0)
    const orphans = declared.filter(
      (name) => !existsSync(resolve(REPO_ROOT, 'functions', name, 'index.ts')),
    )
    expect(orphans).toEqual([])
  })

  // The build may exceed the blueprint — `heartbeat` is built and commented out,
  // so enabling it is uncommenting, not rebuilding. It may never fall short.
  test('every declared Function is built', () => {
    expect(declared.filter((name) => !built.includes(name))).toEqual([])
  })

  test('every source directory is built, and every build entry has a source', () => {
    expect([...built].sort()).toEqual([...sources].sort())
  })
})

/**
 * The names a barrel exports. No barrel in this repo re-exports with `export *`
 * — the test asserts that rather than pretending to follow one.
 */
function exportedNames(source: string): Set<string> {
  const names = new Set<string>()

  for (const match of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const specifier of match[1].split(',')) {
      const local = specifier.trim().replace(/^type\s+/, '')
      if (!local) continue
      const parts = local.split(/\s+as\s+/)
      names.add(parts[parts.length - 1].trim())
    }
  }

  for (const match of source.matchAll(
    /export\s+(?:declare\s+)?(?:async\s+)?(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    names.add(match[1])
  }

  return names
}

/**
 * The symbols a README's export tables claim.
 *
 * Deliberately narrow: only the first column of a table under a
 * `### \`@starter/…\`` heading, and only backticked tokens that are bare
 * identifiers once a call's arguments are dropped. A cell naming a type in
 * prose, or a document type like `l10n.locale`, is not a claim about an export
 * and is not treated as one.
 */
function exportTables(readme: string): Map<string, string[]> {
  const tables = new Map<string, string[]>()
  let entry: null | string = null

  for (const line of readme.split('\n')) {
    const heading = line.match(/^#{2,3}\s+`(@starter\/[\w@/.-]+)`/)
    if (heading) {
      entry = heading[1]
      continue
    }
    if (line.startsWith('#')) entry = null
    if (!entry || !line.startsWith('|')) continue

    const firstCell = line.split('|')[1] ?? ''
    if (firstCell.trim() === 'Export' || /^[\s:-]+$/.test(firstCell)) continue

    const symbols = [...firstCell.matchAll(/`([^`]+)`/g)]
      .map((match) => match[1].split('(')[0].trim())
      .filter((symbol) => /^[A-Za-z_$][\w$]*$/.test(symbol))

    tables.set(entry, [...(tables.get(entry) ?? []), ...symbols])
  }

  return tables
}

interface PackageEntries {
  name: string
  readme: string
  /** Entry specifier → absolute barrel path. */
  barrels: Map<string, string>
}

function packagesWithReadmes(): PackageEntries[] {
  const root = resolve(REPO_ROOT, 'packages')
  const found: PackageEntries[] = []

  for (const entry of readdirSync(root, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue
    const directory = resolve(root, entry.name)
    if (!existsSync(resolve(directory, 'README.md'))) continue

    const manifest: {exports?: Record<string, {source: string}>; name: string} = JSON.parse(
      readFileSync(resolve(directory, 'package.json'), 'utf8'),
    )
    // No entry barrels, nothing an export table could claim.
    if (!manifest.exports) continue

    const barrels = new Map<string, string>()
    for (const [subpath, target] of Object.entries(manifest.exports)) {
      const specifier = subpath === '.' ? manifest.name : `${manifest.name}${subpath.slice(1)}`
      barrels.set(specifier, resolve(directory, target.source))
    }

    found.push({
      name: manifest.name,
      readme: readFileSync(resolve(directory, 'README.md'), 'utf8'),
      barrels,
    })
  }

  return found
}

describe.each(packagesWithReadmes())('$name README', (pkg) => {
  test('every export table names a real entry, and every symbol is on its barrel', () => {
    const tables = exportTables(pkg.readme)
    expect(tables.size).toBeGreaterThan(0)

    const unresolved: string[] = []
    for (const [entry, symbols] of tables) {
      const barrel = pkg.barrels.get(entry)
      if (!barrel) {
        unresolved.push(`${entry}: not an entry of ${pkg.name}`)
        continue
      }
      const source = readFileSync(barrel, 'utf8')
      expect(source).not.toMatch(/^export \*/m)

      const exported = exportedNames(source)
      for (const symbol of symbols) {
        if (!exported.has(symbol)) unresolved.push(`${entry}: \`${symbol}\``)
      }
    }

    expect(unresolved).toEqual([])
  })
})

describe('workflow package versions', () => {
  test('every version in prose matches the catalog pin', () => {
    const workspace = readFileSync(resolve(REPO_ROOT, 'pnpm-workspace.yaml'), 'utf8')
    const catalog = new Map(
      [...workspace.matchAll(/^\s+'(@sanity\/workflow-[a-z-]+)':\s*(\S+)/gm)].map((match) => [
        match[1],
        match[2],
      ]),
    )
    expect(catalog.size).toBeGreaterThan(0)

    const stale: string[] = []
    for (const file of markdownFiles) {
      for (const match of file.text.matchAll(/(@sanity\/workflow-[a-z-]+)@(\d[\w.-]*)/g)) {
        const pinned = catalog.get(match[1])
        if (pinned !== match[2]) {
          stale.push(`${file.path}: ${match[0]} — catalog pins ${pinned ?? 'nothing'}`)
        }
      }
    }

    expect(stale).toEqual([])
  })
})
