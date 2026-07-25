/**
 * The skills under evaluation, read off disk exactly as an agent would see them.
 *
 * Nothing here knows what a case expects — the corpus and the expectations are
 * kept apart so a worker prompt can be built from one without leaking the other.
 */

import {readdirSync, readFileSync, statSync} from 'node:fs'
import {resolve} from 'node:path'

export const REPO_ROOT = resolve(import.meta.dirname, '../..')
export const SKILLS_ROOT = resolve(REPO_ROOT, 'skills')

/** The skill names this repo ships. Case files may only refer to these, or `none`. */
export const SKILL_NAMES = ['sanity-l10n', 'add-l10n-frontend'] as const

export type SkillName = (typeof SKILL_NAMES)[number]

export function isSkillName(value: string): value is SkillName {
  return SKILL_NAMES.some((name) => name === value)
}

export interface SkillFile {
  /** Path relative to the skill directory, e.g. `references/pattern.md`. */
  path: string
  absolutePath: string
  text: string
}

export interface Skill {
  name: SkillName
  directory: string
  frontmatter: {name: string; description: string}
  /** SKILL.md plus every reference file. */
  files: SkillFile[]
  skillMd: SkillFile
}

function readFrontmatter(text: string): {name: string; description: string} {
  const match = text.match(/^---\n([\s\S]*?)\n---/)
  if (!match) throw new Error('SKILL.md has no YAML frontmatter block')

  const block = match[1]
  const name = block.match(/^name:\s*(.+)$/m)?.[1]?.trim()
  // A description is a quoted YAML scalar that may wrap over several lines. The
  // formatter picks the quote style, so accept either.
  const rawDescription = block.match(/^description:\s*([\s\S]+?)(?:\n[a-z-]+:|$)/m)?.[1]?.trim()

  if (!name || !rawDescription) throw new Error('SKILL.md frontmatter needs name and description')

  const unquoted = rawDescription
    .replace(/^'([\s\S]*)'$/, '$1')
    .replace(/''/g, "'")
    .replace(/^"([\s\S]*)"$/, '$1')
    .replace(/\\"/g, '"')
  return {name, description: unquoted.replace(/\s+/g, ' ')}
}

function collectFiles(directory: string, prefix = ''): SkillFile[] {
  const files: SkillFile[] = []
  for (const entry of readdirSync(directory).sort()) {
    const absolutePath = resolve(directory, entry)
    const path = prefix ? `${prefix}/${entry}` : entry
    if (statSync(absolutePath).isDirectory()) {
      files.push(...collectFiles(absolutePath, path))
      continue
    }
    if (!entry.endsWith('.md')) continue
    files.push({path, absolutePath, text: readFileSync(absolutePath, 'utf8')})
  }
  return files
}

export function readSkill(name: SkillName): Skill {
  const directory = resolve(SKILLS_ROOT, name)
  const files = collectFiles(directory)
  const skillMd = files.find((file) => file.path === 'SKILL.md')
  if (!skillMd) throw new Error(`${name} has no SKILL.md`)

  return {name, directory, frontmatter: readFrontmatter(skillMd.text), files, skillMd}
}

export const skills: Skill[] = SKILL_NAMES.map(readSkill)

export function skillByName(name: SkillName): Skill {
  const skill = skills.find((candidate) => candidate.name === name)
  if (!skill) throw new Error(`Unknown skill ${name}`)
  return skill
}

/** The text an agent would hold after loading SKILL.md plus the named references. */
export function corpusFor(name: SkillName, referencePaths: string[]): string {
  const skill = skillByName(name)
  const wanted = ['SKILL.md', ...referencePaths]
  return wanted
    .map((path) => {
      const file = skill.files.find((candidate) => candidate.path === path)
      if (!file) throw new Error(`${name} has no file ${path}`)
      return `===== ${path} =====\n${file.text}`
    })
    .join('\n\n')
}
