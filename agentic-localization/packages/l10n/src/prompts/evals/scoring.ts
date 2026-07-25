import type {EvalCase, ExpectedTerm, ScoreResult} from './types'

function matches(output: string, term: ExpectedTerm): boolean {
  return Array.isArray(term)
    ? term.some((surfaceForm) => output.includes(surfaceForm))
    : output.includes(term)
}

function describe(term: ExpectedTerm): string {
  return Array.isArray(term) ? term.join(' | ') : term
}

export function checkTermPresence(
  output: string,
  shouldContain: ExpectedTerm[],
): {pass: boolean; missing: string[]} {
  const missing = shouldContain.filter((term) => !matches(output, term)).map(describe)
  return {pass: missing.length === 0, missing}
}

export function checkTermAbsence(
  output: string,
  shouldNotContain: ExpectedTerm[],
): {pass: boolean; found: string[]} {
  const found = shouldNotContain.filter((term) => matches(output, term)).map(describe)
  return {pass: found.length === 0, found}
}

export function checkPatterns(
  output: string,
  patterns: RegExp[],
): {pass: boolean; failed: string[]} {
  const failed = patterns.filter((p) => !p.test(output)).map((p) => p.source)
  return {pass: failed.length === 0, failed}
}

export function scorePrompt(output: string, expectations: EvalCase['expectations']): ScoreResult {
  const details: string[] = []
  let passed = 0
  let total = 0

  if (expectations.shouldContain?.length) {
    const result = checkTermPresence(output, expectations.shouldContain)
    total += expectations.shouldContain.length
    passed += expectations.shouldContain.length - result.missing.length
    if (result.missing.length) {
      details.push(`Missing terms: ${result.missing.join(', ')}`)
    }
  }

  if (expectations.shouldNotContain?.length) {
    const result = checkTermAbsence(output, expectations.shouldNotContain)
    total += expectations.shouldNotContain.length
    passed += expectations.shouldNotContain.length - result.found.length
    if (result.found.length) {
      details.push(`Unexpected terms found: ${result.found.join(', ')}`)
    }
  }

  if (expectations.shouldMatchPattern?.length) {
    const result = checkPatterns(output, expectations.shouldMatchPattern)
    total += expectations.shouldMatchPattern.length
    passed += expectations.shouldMatchPattern.length - result.failed.length
    if (result.failed.length) {
      details.push(`Failed patterns: ${result.failed.join(', ')}`)
    }
  }

  return {
    pass: passed === total,
    passed,
    total,
    details,
  }
}
