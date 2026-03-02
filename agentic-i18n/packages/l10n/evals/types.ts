import type {Glossary, StyleGuide} from '../src/promptAssembly'

/**
 * An eval case defines a translation scenario and what the assembled prompt
 * should contain (with context) vs what it lacks (without context).
 *
 * Follows the key_facts pattern from agent-context-evals:
 * deterministic checks that don't require an API call.
 */
export interface EvalCase {
  id: string
  description: string
  sourceText: string
  sourceLocale: string
  targetLocale: string
  glossaries: Glossary[]
  styleGuide?: StyleGuide
  /** What the assembled prompt SHOULD contain */
  expectations: {
    shouldContain?: string[]
    shouldNotContain?: string[]
    shouldMatchPattern?: RegExp[]
    description: string
  }
  /** What a bare (no-context) prompt would miss — documents the risk */
  baselineRisks: string[]
}

/**
 * Result of scoring a prompt against an eval case's expectations.
 */
export interface ScoreResult {
  pass: boolean
  passed: number
  total: number
  details: string[]
}
