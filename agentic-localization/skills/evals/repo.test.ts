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
 * The barrels are the API reference — every entry in a package's `exports` map
 * points at an explicit barrel, and an explicit barrel never `export *`s: what
 * is public is what a reader can see named, with its TSDoc, in one file.
 */
interface PackageBarrels {
  name: string
  /** Entry specifier → absolute barrel path. */
  barrels: Map<string, string>
}

function packagesWithBarrels(): PackageBarrels[] {
  const root = resolve(REPO_ROOT, 'packages')
  const found: PackageBarrels[] = []

  for (const entry of readdirSync(root, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue
    const directory = resolve(root, entry.name)

    const manifest: {exports?: Record<string, string | {source?: string}>; name: string} =
      JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'))
    if (!manifest.exports) continue

    const barrels = new Map<string, string>()
    for (const [subpath, target] of Object.entries(manifest.exports)) {
      const source = typeof target === 'string' ? target : target.source
      // An export without a TypeScript source (a JSON or asset entry) is not a barrel.
      if (!source || !/\.tsx?$/.test(source)) continue
      const specifier = subpath === '.' ? manifest.name : `${manifest.name}${subpath.slice(1)}`
      barrels.set(specifier, resolve(directory, source))
    }

    // Config packages (tsconfig) export no TypeScript surface.
    if (barrels.size === 0) continue

    found.push({name: manifest.name, barrels})
  }

  return found
}

describe.each(packagesWithBarrels())('$name barrels', (pkg) => {
  test('every entry resolves to an explicit barrel', () => {
    for (const [entry, barrel] of pkg.barrels) {
      expect(existsSync(barrel), `${entry}: missing barrel ${barrel}`).toBe(true)
      expect(readFileSync(barrel, 'utf8')).not.toMatch(/^export \*/m)
    }
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
