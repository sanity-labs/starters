/**
 * The roster the routing grader chooses from.
 *
 * The two skills under test, read from their own frontmatter, plus stand-ins for
 * the ambient Sanity skills a real agent has loaded. The stand-ins exist so a
 * hard negative has somewhere correct to go: a description that wins a query it
 * should lose is only visible when a better home is on the list.
 *
 * Keep the stand-in descriptions short and honest. They are competition, not
 * documentation — inflating them would make routing look better than it is.
 */

import {skills} from './corpus'

interface RosterEntry {
  name: string
  description: string
}

const AMBIENT: RosterEntry[] = [
  {
    name: 'sanity-best-practices',
    description:
      'General Sanity development guidance, including internationalization content modelling: document-level versus field-level localization, choosing between @sanity/document-internationalization and internationalizedArray, language field design, and schema conventions.',
  },
  {
    name: 'content-modeling-best-practices',
    description:
      'How to model content in Sanity: document versus object types, references versus embedding, arrays, validation, and modelling for editor experience and querying.',
  },
  {
    name: 'sanity-migration',
    description:
      'Write and run Sanity content migrations: the migration API, dry runs, patching at scale, renaming fields, and transforming documents across a dataset.',
  },
  {
    name: 'sanity-typegen',
    description:
      'Run Sanity TypeGen and troubleshoot type generation: schema extraction, generated query result types, configuration of the paths TypeGen scans, and why a type resolves to any.',
  },
  {
    name: 'portable-text-serialization',
    description:
      'Render and serialize Portable Text: mapping block types, marks, annotations and custom types to components, and converting Portable Text to and from other formats.',
  },
  {
    name: 'sanity-agent-actions',
    description:
      'Use Sanity Agent Actions: generate, transform, translate and prompt. Targeting fields and paths, instruction authoring, and the API surface on @sanity/client.',
  },
  {
    name: 'editorial-workflows',
    description:
      'Sanity Editorial Workflows in general: defining stages, activities, actions, transitions and guards for any editorial process such as review and approval chains, independent of any particular domain.',
  },
  {
    name: 'starter',
    description:
      'Conventions for building Sanity starter templates: project structure, env management, shared config packages, formatting, CI workflows, blueprints and pnpm workspace patterns.',
  },
  {
    name: 'frontend-performance',
    description:
      'React and Next.js performance: data fetching, caching, bundle size, rendering strategy and Core Web Vitals.',
  },
]

export function roster(): RosterEntry[] {
  const local = skills.map((skill) => ({
    name: skill.frontmatter.name,
    description: skill.frontmatter.description,
  }))
  // Interleaved rather than local-first, so position cannot stand in for
  // relevance in the grader's answer.
  const merged = [...AMBIENT.slice(0, 4), ...local, ...AMBIENT.slice(4)]
  return merged
}

export function rosterText(): string {
  return roster()
    .map((entry) => `- ${entry.name}: ${entry.description}`)
    .join('\n')
}

export function rosterNames(): string[] {
  return roster().map((entry) => entry.name)
}
