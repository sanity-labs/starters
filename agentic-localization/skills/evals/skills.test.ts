/**
 * The deterministic half of the skill evals: everything about these skills that
 * can be checked without a model.
 *
 * Three properties, and each one has caught a real defect:
 *  1. Drift — every repo path a skill names still exists. The rewrite these
 *     evals ship with replaced a dozen paths that had silently moved.
 *     `repo.test.ts` runs the same check over every markdown file in the repo.
 *  2. Coverage — for each scenario in `cases/scenarios.json`, the files an agent
 *     would load actually name the file, entry or command the answer needs.
 *     A rubric can be argued with; a missing filename cannot.
 *  3. Hygiene — the frontmatter carries a description that routes, the trigger
 *     surface names its negatives, and no case leaks a skill name to the router.
 */

import {existsSync, statSync} from 'node:fs'
import {resolve} from 'node:path'
import {describe, expect, test} from 'vitest'

import routingCases from './cases/routing.json' with {type: 'json'}
import scenarios from './cases/scenarios.json' with {type: 'json'}

import {corpusFor, isSkillName, REPO_ROOT, skills, SKILL_NAMES} from './corpus'
import {codeSpanPaths, linkTargets} from './docs'

/**
 * Paths that used to be real and are the most likely thing to be reintroduced
 * from memory — the pre-split package layout, the renamed style-guide type, and
 * the Next convention this app no longer uses.
 */
const STALE_TOKENS = [
  'packages/l10n/src/schemas/',
  'packages/l10n/src/plugin.ts',
  'packages/l10n/src/translations/',
  'packages/l10n/src/promptAssembly.ts',
  'packages/l10n/src/prompts/evals/authToken.ts',
  'l10n.style-guide',
  'kit.agentic-l10n',
  'src/middleware.ts',
]

describe.each(skills)('$name', (skill) => {
  test('frontmatter name matches the directory', () => {
    expect(skill.frontmatter.name).toBe(skill.name)
  })

  test('description states what it does, when to trigger, and what it refuses', () => {
    const {description} = skill.frontmatter
    // Long enough to carry a trigger surface, short enough to stay in context.
    expect(description.length).toBeGreaterThan(400)
    expect(description.length).toBeLessThan(2000)
    expect(description).toMatch(/DO NOT use/)
    // Every negative has to name where the request belongs instead, or the
    // router has nowhere to send it.
    for (const sibling of SKILL_NAMES.filter((name) => name !== skill.name)) {
      expect(description).toContain(sibling)
    }
    expect(description).toContain('sanity-best-practices')
  })

  test('every repo path it names exists', () => {
    const missing: string[] = []

    for (const file of skill.files) {
      for (const token of codeSpanPaths(file.text)) {
        const candidate = resolve(REPO_ROOT, token)
        if (!existsSync(candidate)) missing.push(`${file.path}: \`${token}\``)
      }
      for (const target of linkTargets(file.text)) {
        const candidate = resolve(file.absolutePath, '..', target)
        if (!existsSync(candidate)) missing.push(`${file.path}: [](${target})`)
      }
    }

    expect(missing).toEqual([])
  })

  test('names no path that has moved', () => {
    const found: string[] = []
    for (const file of skill.files) {
      for (const token of STALE_TOKENS) {
        if (file.text.includes(token)) found.push(`${file.path}: ${token}`)
      }
    }
    expect(found).toEqual([])
  })

  test('SKILL.md points at every reference it ships, and ships every one it points at', () => {
    const references = skill.files
      .filter((file) => file.path.startsWith('references/'))
      .map((file) => file.path)

    for (const path of references) {
      expect(skill.skillMd.text).toContain(path)
    }

    const pointed = [...skill.skillMd.text.matchAll(/`(references\/[\w-]+\.md)`/g)].map(
      (match) => match[1],
    )
    for (const path of new Set(pointed)) {
      expect(references).toContain(path)
    }
  })

  test('stays inside the progressive-disclosure budget', () => {
    const skillMdLines = skill.skillMd.text.split('\n').length
    expect(skillMdLines).toBeLessThan(500)
    for (const file of skill.files) {
      // Past ~300 lines a reference needs a table of contents; keeping them
      // under that is cheaper than maintaining one.
      expect(file.text.split('\n').length).toBeLessThan(300)
    }
  })
})

describe('scenario coverage', () => {
  test('every scenario names a real skill and real reference files', () => {
    for (const scenario of scenarios) {
      expect(isSkillName(scenario.skill)).toBe(true)
      for (const path of scenario.load) {
        expect(statSync(resolve(REPO_ROOT, 'skills', scenario.skill, path)).isFile()).toBe(true)
      }
    }
  })

  test.each(scenarios)('$id: the loaded corpus names what the answer needs', (scenario) => {
    if (!isSkillName(scenario.skill)) throw new Error(`Unknown skill ${scenario.skill}`)
    const corpus = corpusFor(scenario.skill, scenario.load)

    const absent = scenario.mustName.filter((needle) => !corpus.includes(needle))
    expect(absent).toEqual([])
  })

  test('every category of adoption ask is covered', () => {
    const categories = new Set(scenarios.map((scenario) => scenario.category))
    for (const required of ['greenfield', 'brownfield', 'extension', 'operate', 'frontend']) {
      expect([...categories]).toContain(required)
    }
  })
})

describe('routing cases', () => {
  test('expectations reference known skills', () => {
    for (const routingCase of routingCases) {
      if (routingCase.expect === 'none') continue
      expect(isSkillName(routingCase.expect)).toBe(true)
    }
  })

  test('no query names a skill, a package or a repo path', () => {
    const leaks: string[] = []
    for (const routingCase of routingCases) {
      const query = routingCase.query.toLowerCase()
      for (const name of SKILL_NAMES) {
        if (query.includes(name)) leaks.push(`${routingCase.id}: names ${name}`)
      }
      if (/@starter\/|packages\/l10n|skills\//.test(query)) {
        leaks.push(`${routingCase.id}: names a repo path`)
      }
    }
    expect(leaks).toEqual([])
  })

  test('ids are unique', () => {
    const ids = routingCases.map((routingCase) => routingCase.id)
    expect(new Set(ids).size).toBe(ids.length)
    const scenarioIds = scenarios.map((scenario) => scenario.id)
    expect(new Set(scenarioIds).size).toBe(scenarioIds.length)
  })

  test('the set is balanced enough to be discriminating', () => {
    const kinds = routingCases.map((routingCase) => routingCase.kind)
    const count = (kind: string) => kinds.filter((value) => value === kind).length
    // Hard negatives are the half that catches an over-eager description, so
    // they are not allowed to be an afterthought.
    expect(count('positive')).toBeGreaterThanOrEqual(15)
    expect(count('negative')).toBeGreaterThanOrEqual(10)
    expect(count('ambiguous')).toBeGreaterThanOrEqual(3)
    for (const skillName of SKILL_NAMES) {
      const positives = routingCases.filter(
        (routingCase) => routingCase.kind === 'positive' && routingCase.expect === skillName,
      )
      expect(positives.length).toBeGreaterThanOrEqual(5)
    }
  })
})
