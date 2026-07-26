/**
 * Conditional Gherkin tags.
 *
 * racejar acts on `@skip` and `@only` and ignores every other tag, so a tag
 * whose meaning is "run this only when the environment allows it" is applied by
 * rewriting the feature text before it is compiled: the tag stays in the
 * `.feature` as the documented precondition, and the gate inserts the `@skip`
 * the driver understands, with the reason printed once.
 *
 * The alternative — failing the scenario — would make the suite red for an
 * environment condition rather than for a defect, and a suite that is red for a
 * known reason is a suite nobody reads.
 */

import type {Session} from './session'

/** A closed gate: why the tagged scenarios cannot run here. */
export type GateReason = string | undefined

const SKIP_TAG = '@skip'

/**
 * Ask a session-driven probe, closing the session if it throws.
 *
 * A probe runs in module scope, before `afterAll` is registered, so a throw
 * there would leave Chromium alive until the worker exits. The error is what
 * the run should report, so it is rethrown — just not with a browser attached.
 */
export async function probeGate<T>(session: Session, ask: () => Promise<T>): Promise<T> {
  try {
    return await ask()
  } catch (error) {
    await session.close()
    throw error
  }
}

/**
 * @param featureText - the raw `.feature` source
 * @param gates - conditional tag → why it is closed, or `undefined` to let it run
 */
export function gateFeature(featureText: string, gates: Record<string, GateReason>): string {
  return Object.entries(gates).reduce(
    (text, [tag, blocked]) => gateTag(text, tag, blocked),
    featureText,
  )
}

function gateTag(featureText: string, tag: string, blocked: GateReason): string {
  const lines = featureText.split('\n')
  const tagged = lines.filter((line) => line.trim().split(/\s+/).includes(tag))

  if (tagged.length === 0) {
    throw new Error(`[e2e] no "${tag}" tag in the feature — the gate is wired to nothing`)
  }
  if (blocked === undefined) return featureText

  console.log(`[e2e] ${tag}: ${blocked}`)

  return lines
    .flatMap((line) => {
      if (!line.trim().split(/\s+/).includes(tag)) return [line]
      const indent = line.slice(0, line.length - line.trimStart().length)
      return [`${indent}${SKIP_TAG}`, line]
    })
    .join('\n')
}
