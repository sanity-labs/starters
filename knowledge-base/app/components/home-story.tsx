import Link from 'next/link'

const MODES = [
  {
    code: 'SC02',
    mode: 'GROQ',
    title: 'Structured facts, queried live',
    body: 'Filterable fields on product and faq. Exact at any scale. No build step. Use it when the answer is a price, a plan, or a single FAQ.',
    ask: 'Which plan includes SMS under $200/mo?',
    href: '/chat',
  },
  {
    code: 'SC03',
    mode: 'KB',
    title: 'Grounded prose, built ahead',
    body: 'A Knowledge Base is a pre-built index. A build writes entries, files Issues where sources disagree, and serves an outline the agent holds in context.',
    ask: "Is a paused campaign's audience still billed?",
    href: '/chat',
  },
] as const

const STEPS = [
  {
    n: '01',
    label: 'Sources',
    title: 'Attach dataset and files',
    body: 'Published help articles come from a dataset query. Customer PDFs are uploaded beside them. Multiple sources belong on the Knowledge Base. Never mix a dataset and a Knowledge Base on the same MCP.',
  },
  {
    n: '02',
    label: 'Build',
    title: 'Write the outline and entries',
    body: 'Build entries. The purpose you wrote is the starting outline. When status reads Entries up to date, the agent can retrieve grounded Markdown instead of guessing across files.',
  },
  {
    n: '03',
    label: 'Issues',
    title: 'Decide when sources disagree',
    body: 'The finance PDF says 45 days. The help article says 30. A Knowledge Base does not pick. The build should raise an Issue; if it does not, add the Instruction yourself. Keep 30. Either way that choice is an Instruction.',
  },
  {
    n: '04',
    label: 'Serve',
    title: 'One source type per MCP',
    body: 'beacon-catalog is GROQ over the dataset. beacon-support-kb is the customer Knowledge Base. Pair them on /chat. The agent picks one mode per question.',
  },
] as const

export function HomeStory() {
  return (
    <>
      <section className="dot-grid border-b border-border-faint">
        <div className="mx-auto max-w-5xl px-4 py-16 md:py-20">
          <p className="font-mono text-micro uppercase tracking-wide text-fg-subtle">
            SC01 · Sanity Context
          </p>
          <h1 className="mt-4 max-w-[16ch] text-balance text-display-sm font-semibold text-fg-base md:text-display-md">
            Help from content you can correct
          </h1>
          <p className="mt-6 max-w-2xl text-body-lg text-fg-muted">
            Beacon is the customer face of this starter. Structured facts answer through GROQ.
            How-to and policy prose answer through a Knowledge Base. Same dataset. One mode per
            question. This is not a vector database.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/chat"
              className="rounded-sm bg-brand px-4 py-2.5 text-sm font-medium text-white duration-fast hover:bg-brand-hover"
            >
              Ask the support agent
            </Link>
            <Link
              href="/internal"
              className="rounded-sm border border-border-base px-4 py-2.5 text-sm font-medium text-fg-base duration-fast hover:bg-bg-subtle"
            >
              Open the ops agent
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-border-faint">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <header className="mb-10 flex items-baseline justify-between border-b border-border-base pb-4">
            <h2 className="text-display-sm font-semibold text-fg-base">Two retrieval modes</h2>
            <span className="font-mono text-caption uppercase tracking-wider text-fg-subtle">
              SC02 · SC03
            </span>
          </header>
          <div className="grid gap-4 md:grid-cols-2">
            {MODES.map((item) => (
              <article
                key={item.code}
                className="flex flex-col rounded-sm border border-border-faint bg-bg-card p-6"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="font-mono text-caption font-medium text-fg-accent">
                    {item.code}
                  </span>
                  <span className="inline-flex items-center rounded-sm border border-border-faint px-1.5 py-0.5 font-mono text-micro uppercase tracking-wide text-fg-subtle">
                    {item.mode}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-fg-base">{item.title}</h3>
                <p className="mt-3 flex-1 text-sm text-fg-muted">{item.body}</p>
                <Link
                  href={item.href}
                  className="mt-6 block rounded-sm border border-border-faint bg-bg-subtle px-4 py-3 duration-fast hover:bg-bg-base"
                >
                  <p className="font-mono text-micro uppercase tracking-wide text-fg-subtle">
                    Try this
                  </p>
                  <p className="mt-1 text-sm text-fg-base">{item.ask}</p>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border-faint">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <p className="font-mono text-micro uppercase tracking-wide text-fg-subtle">
            KB01 · Build
          </p>
          <h2 className="mt-3 max-w-[20ch] text-balance text-display-sm font-semibold text-fg-base">
            A Knowledge Base is an index you review
          </h2>
          <p className="mt-4 max-w-2xl text-fg-muted">
            Attach sources. Build entries. Resolve the facts that matter. Then serve the Knowledge
            Base through its own MCP. Change the article in Studio, or add an Instruction, when the
            answer should change.
          </p>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2">
            {STEPS.map((step) => (
              <li key={step.n} className="border-t border-border-faint pt-4">
                <div className="mb-3 flex items-baseline gap-3">
                  <span className="font-mono text-lg font-semibold text-fg-accent">{step.n}</span>
                  <span className="font-mono text-micro uppercase tracking-wide text-fg-subtle">
                    {step.label}
                  </span>
                </div>
                <h3 className="font-semibold text-fg-base">{step.title}</h3>
                <p className="mt-2 text-sm text-fg-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-bg-inverse text-fg-inverse">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <p className="font-mono text-micro uppercase tracking-wide text-gray-400">
            KB02 · The refund window
          </p>
          <h2 className="mt-3 max-w-[18ch] text-balance text-display-sm font-semibold">
            Sources can disagree. The Issue is the point.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-sm border border-gray-800 bg-gray-950 p-5">
              <p className="font-mono text-micro uppercase tracking-wide text-gray-400">
                Help article · FAQ
              </p>
              <p className="mt-3 text-lg font-semibold">30 days</p>
              <p className="mt-2 text-sm text-gray-400">
                From the original invoice date. Ground truth after you resolve the Issue.
              </p>
            </div>
            <div className="rounded-sm border border-gray-800 bg-gray-950 p-5">
              <p className="font-mono text-micro uppercase tracking-wide text-gray-400">
                Finance PDF
              </p>
              <p className="mt-3 text-lg font-semibold">45 days</p>
              <p className="mt-2 text-sm text-gray-400">
                beacon-billing-refund-policy.pdf measures from the charge date. Stale on purpose.
              </p>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-sm text-gray-400">
            Ask the support agent for the refund window after you keep the 30-day claim. Ops GROQ
            still quotes the internal policy. That split is the demo.
          </p>
        </div>
      </section>
    </>
  )
}
