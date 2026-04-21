import mjml from 'mjml'

export async function* renderMjmlStream(mjmlContent: string): AsyncGenerator<string> {
  const {html, errors} = await mjml(mjmlContent)
  if (errors.length > 0) console.warn('MJML rendering warnings:', errors)
  yield html
}

export async function streamToString(source: AsyncIterable<string>): Promise<string> {
  const chunks: string[] = []
  for await (const chunk of source) {
    chunks.push(chunk)
  }
  return chunks.join('')
}
