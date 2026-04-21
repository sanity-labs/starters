export type StubReplacementMap = Record<string, string>

export async function* stubReplacer(
  source: AsyncIterable<string>,
  replacements: StubReplacementMap,
): AsyncGenerator<string> {
  let buffer = ''

  for await (const chunk of source) {
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    let output = lines.join('\n')
    for (const [stub, replacement] of Object.entries(replacements)) {
      output = output.replace(new RegExp(`{{\\s*${stub}\\s*}}`, 'g'), replacement)
    }
    if (output) yield `${output}\n`
  }

  if (buffer) {
    let output = buffer
    for (const [stub, replacement] of Object.entries(replacements)) {
      output = output.replace(new RegExp(`{{\\s*${stub}\\s*}}`, 'g'), replacement)
    }
    yield output
  }
}
