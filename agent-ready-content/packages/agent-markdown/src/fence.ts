const MIN_FENCE_LENGTH = 3

/**
 * Pick a code fence that the code itself cannot close early. CommonMark
 * closes a fence at the first backtick run at least as long as the
 * opener, so content that contains ``` (a markdown tutorial, a shell
 * snippet quoting a fence) needs a longer opener or everything after
 * the embedded run renders as prose.
 *
 * @param code Raw code block content
 * @returns A run of backticks longer than any run inside `code`, never shorter than three
 */
export function fenceFor(code: string): string {
  const backtickRuns = code.match(/`+/g) ?? []
  const longestRun = backtickRuns.reduce((longest, run) => Math.max(longest, run.length), 0)
  return '`'.repeat(Math.max(MIN_FENCE_LENGTH, longestRun + 1))
}
