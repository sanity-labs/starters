// Renders the seed markdown under studio/seed/files/ into multi-page PDFs that
// look like the documents they imitate: a finance policy, a Confluence export,
// an on-call runbook. The markdown next to each PDF is the editable source of
// truth; regenerate after editing it.
//
//   pnpm --filter studio seed:files
//
// PDFs are committed so `pnpm bootstrap` never needs a browser. Regeneration
// needs Playwright once:
//
//   pnpm --filter studio add -D playwright
//   pnpm --filter studio exec playwright install chromium
//
// Set PDF_CHROMIUM=/path/to/chrome to reuse a browser you already have.
import {readdirSync, readFileSync, writeFileSync} from 'node:fs'
import {basename, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const filesRoot = fileURLToPath(new URL('../seed/files', import.meta.url))

// ---------------------------------------------------------------------------
// Minimal markdown renderer. Covers what the seed files use: ATX headings,
// paragraphs, bullet and numbered lists (one level of nesting), pipe tables,
// blockquotes, fenced code, horizontal rules, bold, italic, inline code,
// links, and HTML comments (stripped, so maintainers' notes never print).
// ---------------------------------------------------------------------------

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inline(text: string): string {
  let out = escapeHtml(text)
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  return out
}

function renderTable(rows: string[]): string {
  const cells = (line: string) =>
    line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim())
  const header = cells(rows[0])
  const body = rows.slice(2).map(cells)
  const th = header.map((h) => `<th>${inline(h)}</th>`).join('')
  const tr = body
    .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
    .join('\n')
  return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`
}

function renderList(lines: string[]): string {
  // lines are already known to be list items (possibly indented)
  type Item = {text: string; children: string[]}
  const items: Item[] = []
  let ordered = false
  for (const raw of lines) {
    const indent = raw.match(/^\s*/)?.[0].length ?? 0
    const line = raw.trim()
    const m = line.match(/^(\d+)[.)]\s+(.*)$/) ?? line.match(/^[-*]\s+(.*)$/)
    if (!m) {
      if (items.length) items[items.length - 1].text += ` ${line}`
      continue
    }
    const text = m.length === 3 ? m[2] : m[1]
    if (indent >= 2 && items.length) {
      items[items.length - 1].children.push(raw.trim())
    } else {
      if (!items.length) ordered = /^\d/.test(line)
      items.push({text, children: []})
    }
  }
  const tag = ordered ? 'ol' : 'ul'
  const li = items
    .map((it) => `<li>${inline(it.text)}${it.children.length ? renderList(it.children) : ''}</li>`)
    .join('\n')
  return `<${tag}>${li}</${tag}>`
}

export function markdownToHtml(markdown: string): {html: string; meta: Record<string, string>} {
  const src = markdown.replace(/<!--[\s\S]*?-->/g, '')
  const lines = src.split('\n')
  const out: string[] = []
  const meta: Record<string, string> = {}
  let i = 0
  let firstTable = true

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    if (line.startsWith('```')) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++])
      i++
      out.push(`<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`)
      continue
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      const level = h[1].length
      const text = h[2].trim()
      if (level === 1 && !meta.title) meta.title = text
      out.push(`<h${level}>${inline(text)}</h${level}>`)
      i++
      continue
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push('<hr />')
      i++
      continue
    }
    if (line.trim().startsWith('|')) {
      const buf: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) buf.push(lines[i++])
      if (firstTable) {
        firstTable = false
        for (const row of buf.slice(2)) {
          const [k, v] = row
            .trim()
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((c) => c.trim())
          if (k && v) meta[k.toLowerCase()] = v.replace(/\*\*/g, '')
        }
        out.push(`<div class="docmeta">${renderTable(buf)}</div>`)
      } else {
        out.push(renderTable(buf))
      }
      continue
    }
    if (line.startsWith('>')) {
      const buf: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''))
      out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`)
      continue
    }
    if (/^\s*([-*]|\d+[.)])\s+/.test(line)) {
      const buf: string[] = []
      while (
        i < lines.length &&
        (/^\s*([-*]|\d+[.)])\s+/.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))
      ) {
        buf.push(lines[i++])
      }
      out.push(renderList(buf))
      continue
    }
    // paragraph
    const buf: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4})\s/.test(lines[i]) &&
      !lines[i].trim().startsWith('|') &&
      !lines[i].startsWith('>') &&
      !lines[i].startsWith('```') &&
      !/^\s*([-*]|\d+[.)])\s+/.test(lines[i])
    ) {
      buf.push(lines[i++].trim())
    }
    out.push(`<p>${inline(buf.join(' '))}</p>`)
  }
  return {html: out.join('\n'), meta}
}

// ---------------------------------------------------------------------------
// Page chrome. Three looks, chosen from the filename prefix.
// ---------------------------------------------------------------------------

type Look = 'confluence' | 'runbook' | 'policy'

function lookFor(name: string, folder: string): Look {
  if (name.startsWith('confluence-')) return 'confluence'
  if (name.startsWith('runbook-') || name.startsWith('sales-')) return 'runbook'
  return folder === 'internal' ? 'runbook' : 'policy'
}

const baseCss = `
  @page { size: Letter; margin: 0.9in 0.85in 0.95in 0.85in; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; font-size: 10.5pt; line-height: 1.45; color: #1a1a1a; margin: 0; }
  h1 { font-size: 20pt; line-height: 1.2; margin: 0 0 6pt; letter-spacing: -0.01em; }
  h2 { font-size: 13pt; margin: 20pt 0 6pt; padding-bottom: 3pt; border-bottom: 1px solid #c9c9c9; page-break-after: avoid; }
  h3 { font-size: 11pt; margin: 14pt 0 4pt; page-break-after: avoid; }
  h4 { font-size: 10.5pt; margin: 10pt 0 2pt; font-style: italic; page-break-after: avoid; }
  p { margin: 0 0 7pt; orphans: 3; widows: 3; }
  ul, ol { margin: 0 0 8pt; padding-left: 20pt; }
  li { margin-bottom: 3pt; }
  li ul, li ol { margin: 3pt 0 0; }
  table { border-collapse: collapse; width: 100%; margin: 6pt 0 10pt; font-size: 9.5pt; page-break-inside: avoid; }
  th, td { border: 1px solid #b8b8b8; padding: 4pt 6pt; text-align: left; vertical-align: top; }
  th { background: #efefef; font-weight: 600; }
  code { font-family: "Courier New", Courier, monospace; font-size: 9pt; background: #f3f3f3; padding: 0 2pt; }
  pre { background: #f3f3f3; border: 1px solid #ddd; padding: 8pt; font-size: 8.8pt; line-height: 1.35; overflow: hidden; white-space: pre-wrap; page-break-inside: avoid; }
  pre code { background: none; padding: 0; }
  blockquote { margin: 8pt 0; padding: 6pt 10pt; border-left: 3px solid #999; background: #fafafa; color: #333; }
  hr { border: 0; border-top: 1px solid #ccc; margin: 14pt 0; }
  a { color: inherit; text-decoration: underline; }
  .docmeta table { width: auto; min-width: 60%; font-size: 9pt; margin: 4pt 0 14pt; }
  .docmeta th { display: none; }
  .docmeta td:first-child { font-weight: 600; background: #f6f6f6; width: 32%; }
  .banner { font-family: Helvetica, Arial, sans-serif; font-size: 8pt; letter-spacing: 0.08em; text-transform: uppercase; color: #555; margin-bottom: 10pt; }
`

const looks: Record<Look, string> = {
  policy: `
    body { font-family: Georgia, "Times New Roman", serif; }
    .banner { border-bottom: 2px solid #1a1a1a; padding-bottom: 4pt; display: flex; justify-content: space-between; }
  `,
  confluence: `
    body { font-family: Helvetica, Arial, sans-serif; font-size: 10pt; color: #172b4d; }
    h1 { font-size: 22pt; font-weight: 500; }
    h2 { border-bottom: 0; font-size: 14pt; font-weight: 500; color: #172b4d; }
    th { background: #f4f5f7; color: #172b4d; }
    th, td { border-color: #dfe1e6; }
    blockquote { border-left-color: #0052cc; background: #deebff; }
    .banner { color: #5e6c84; text-transform: none; letter-spacing: 0; font-size: 9pt; }
    .banner .crumbs { color: #0052cc; }
    .docmeta td:first-child { background: #f4f5f7; }
    .labels span { display: inline-block; background: #dfe1e6; color: #42526e; border-radius: 3px; padding: 1pt 6pt; margin-right: 4pt; font-size: 8.5pt; }
  `,
  runbook: `
    body { font-family: Helvetica, Arial, sans-serif; font-size: 10pt; }
    h1 { font-size: 19pt; }
    h2 { font-size: 12.5pt; border-bottom: 1px solid #ddd; }
    .banner { background: #1a1a1a; color: #fff; padding: 4pt 8pt; display: inline-block; }
    code { background: #eef1f5; }
  `,
}

function chrome(look: Look, meta: Record<string, string>, folder: string): string {
  const cls =
    meta.classification ?? (folder === 'internal' ? 'Internal - do not forward' : 'Customer')
  if (look === 'confluence') {
    const space = meta.space ?? 'Beacon Wiki'
    const labels = (meta.labels ?? '')
      .split(/,\s*/)
      .filter(Boolean)
      .map((l) => `<span>${escapeHtml(l)}</span>`)
      .join('')
    return `<div class="banner"><span class="crumbs">${escapeHtml(space)}</span> &nbsp;/&nbsp; ${escapeHtml(
      meta.title ?? '',
    )}</div>${labels ? `<div class="labels">${labels}</div>` : ''}`
  }
  if (look === 'runbook') {
    return `<div class="banner">Runbook &nbsp;|&nbsp; ${escapeHtml(cls)}</div>`
  }
  return `<div class="banner"><span>Beacon ${escapeHtml(meta['owner'] ?? '')}</span><span>${escapeHtml(
    meta['doc id'] ?? '',
  )} &nbsp;|&nbsp; ${escapeHtml(cls)}</span></div>`
}

function page(look: Look, body: string, meta: Record<string, string>, folder: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
    meta.title ?? 'Beacon',
  )}</title><style>${baseCss}${looks[look]}</style></head><body>${chrome(look, meta, folder)}${body}</body></html>`
}

function footerTemplate(meta: Record<string, string>, folder: string): string {
  const cls =
    meta.classification ?? (folder === 'internal' ? 'Internal - do not forward' : 'Customer')
  const id = meta['doc id'] ? `${meta['doc id']} ` : ''
  const ver = meta.version ? `${meta.version} ` : ''
  return `<div style="font-family: Helvetica, Arial, sans-serif; font-size: 7.5pt; color: #666; width: 100%; padding: 0 0.85in; display: flex; justify-content: space-between;">
    <span>${escapeHtml(`${id}${ver}`.trim())}${id || ver ? ' &nbsp;|&nbsp; ' : ''}${escapeHtml(cls)}</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>`
}

function headerTemplate(meta: Record<string, string>): string {
  return `<div style="font-family: Helvetica, Arial, sans-serif; font-size: 7.5pt; color: #888; width: 100%; padding: 0 0.85in; display: flex; justify-content: space-between;">
    <span>Beacon</span><span>${escapeHtml(meta.title ?? '')}</span>
  </div>`
}

// ---------------------------------------------------------------------------

async function loadChromium() {
  try {
    const pw = await import('playwright')
    return pw.chromium
  } catch {
    console.error(
      [
        'Playwright is not installed in studio/. The committed PDFs are still valid; regenerate only after editing markdown.',
        '  pnpm --filter studio add -D playwright',
        '  pnpm --filter studio exec playwright install chromium',
      ].join('\n'),
    )
    process.exit(1)
  }
}

async function main() {
  const chromium = await loadChromium()
  const browser = await chromium.launch(
    process.env.PDF_CHROMIUM ? {executablePath: process.env.PDF_CHROMIUM} : {},
  )
  const written: string[] = []
  try {
    for (const folder of ['customer', 'internal'] as const) {
      const dir = join(filesRoot, folder)
      for (const name of readdirSync(dir).sort()) {
        if (!name.endsWith('.md')) continue
        const markdown = readFileSync(join(dir, name), 'utf8')
        const {html, meta} = markdownToHtml(markdown)
        const look = lookFor(basename(name, '.md'), folder)
        const pg = await browser.newPage()
        await pg.setContent(page(look, html, meta, folder), {waitUntil: 'load'})
        const pdf = await pg.pdf({
          format: 'Letter',
          printBackground: true,
          displayHeaderFooter: true,
          headerTemplate: headerTemplate(meta),
          footerTemplate: footerTemplate(meta, folder),
          margin: {top: '0.9in', right: '0.85in', bottom: '0.95in', left: '0.85in'},
        })
        await pg.close()
        const pdfName = name.replace(/\.md$/, '.pdf')
        writeFileSync(join(dir, pdfName), pdf)
        written.push(`${folder}/${pdfName} (${Math.round(pdf.byteLength / 1024)} KB)`)
      }
    }
  } finally {
    await browser.close()
  }
  console.log(`Wrote ${written.length} PDFs:\n${written.map((f) => `  ${f}`).join('\n')}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
