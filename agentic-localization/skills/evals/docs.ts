/**
 * Every markdown file in the repo, and the path tokens inside it.
 *
 * The skill evals started as a drift check over `skills/**`, but a stale path is
 * a stale path wherever it is written — so the same reader serves the whole
 * repo's prose. Nothing here knows what a check expects.
 */

import {readdirSync, readFileSync, statSync} from 'node:fs'
import {resolve} from 'node:path'

import {REPO_ROOT} from './corpus'

export interface MarkdownFile {
  /** Path relative to the repo root, e.g. `docs/functions.md`. */
  path: string
  absolutePath: string
  text: string
}

/** Never walked: build output, dependencies, and tool caches. */
const SKIP_DIRECTORIES = new Set([
  '.git',
  '.next',
  '.sanity',
  '.shots',
  'coverage',
  'dist',
  'node_modules',
])

function walk(directory: string, prefix = ''): MarkdownFile[] {
  const files: MarkdownFile[] = []
  for (const entry of readdirSync(directory).sort()) {
    const absolutePath = resolve(directory, entry)
    const path = prefix ? `${prefix}/${entry}` : entry
    if (statSync(absolutePath).isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry)) continue
      files.push(...walk(absolutePath, path))
      continue
    }
    if (!entry.endsWith('.md')) continue
    files.push({path, absolutePath, text: readFileSync(absolutePath, 'utf8')})
  }
  return files
}

export const markdownFiles: MarkdownFile[] = walk(REPO_ROOT)

/** Directories a repo-relative path token can start with. */
export const REPO_ROOTS = [
  '.github/',
  'apps/',
  'docs/',
  'e2e/',
  'functions/',
  'packages/',
  'skills/',
  'studio/',
]

/**
 * Repo-root files worth naming in prose. Without them a token like
 * `sanity.blueprint.ts` reads as free text and goes unchecked — `operating.md`
 * alone cites that one six times.
 */
export const ROOT_FILES = [
  '.mcp.json',
  'oxlint.config.ts',
  'pnpm-workspace.yaml',
  'sanity.blueprint.ts',
  'sanity.workflow.ts',
]

export function isPathCandidate(token: string): boolean {
  if (/[*<>$\s]/.test(token)) return false
  if (ROOT_FILES.includes(token)) return true
  return REPO_ROOTS.some((root) => token.startsWith(root))
}

/** Repo-relative paths named in inline code spans. */
export function codeSpanPaths(text: string): string[] {
  return [...text.matchAll(/`([^`\n]+)`/g)]
    .map((match) => match[1].trim().replace(/[.,)]$/, ''))
    .filter(isPathCandidate)
}

/** Markdown link targets, resolved against the file that holds them. */
export function linkTargets(text: string): string[] {
  return [...text.matchAll(/\]\(([^)\s]+)\)/g)]
    .map((match) => match[1].split('#')[0])
    .filter((target) => target.length > 0 && !/^[a-z]+:/.test(target))
}
