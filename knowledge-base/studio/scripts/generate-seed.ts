// Generates studio/seed/data.ndjson for the fictional "Beacon" customer
// engagement platform. Run: pnpm --filter studio seed:generate
// Edit the content arrays below and re-run to extend the sample dataset.
import {writeFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'

let counter = 0
const key = () => `k${(counter++).toString(36)}`
const ref = (id: string) => ({_type: 'reference' as const, _ref: id})

type Block = {
  _type: 'block'
  _key: string
  style: string
  listItem?: string
  level?: number
  markDefs: never[]
  children: {_type: 'span'; _key: string; text: string; marks: string[]}[]
}

type Para = string | {style?: string; text: string} | {bullet: string}

// Minimal Portable Text builder: strings become normal blocks, {bullet} become
// bulleted list items, {style} sets a heading/quote style.
function pt(paras: Para[]): Block[] {
  return paras.map((p) => {
    const spec =
      typeof p === 'string' ? {text: p} : 'bullet' in p ? {text: p.bullet, list: true} : p
    const block: Block = {
      _type: 'block',
      _key: key(),
      style: 'style' in spec && spec.style ? spec.style : 'normal',
      markDefs: [],
      children: [{_type: 'span', _key: key(), text: spec.text, marks: []}],
    }
    if ('list' in spec && spec.list) {
      block.listItem = 'bullet'
      block.level = 1
    }
    return block
  })
}

// Dates relative to the demo "today" of 2026-06-02. Deliberate fresh/overdue mix
// so the Needs Review queue and Content Health dashboard light up on first open.
const OVERDUE = ['2026-01-15', '2026-02-20', '2026-03-10', '2026-04-05', '2026-05-01', '2026-05-22']
const FRESH = ['2026-07-15', '2026-08-01', '2026-08-20', '2026-09-10', '2026-09-30']
const at = (d: string) => `${d}T00:00:00Z`

// --- Taxonomy -------------------------------------------------------------

const products = [
  ['campaigns', 'Campaigns', 'Design, schedule, and send multi-channel campaigns.'],
  ['segments', 'Segments', 'Group contacts with live, rule-based audience segments.'],
  ['channels', 'Channels', 'Email, push, SMS, and in-app message delivery.'],
  ['analytics', 'Analytics', 'Engagement, conversion, and deliverability reporting.'],
  ['workflows', 'Workflows', 'Automated, event-triggered messaging journeys.'],
  ['api', 'Developer API', 'REST API, webhooks, and event streaming.'],
]

const topics = [
  ['getting-started', 'Getting Started'],
  ['billing', 'Billing'],
  ['security', 'Security'],
  ['integrations', 'Integrations'],
  ['troubleshooting', 'Troubleshooting'],
  ['administration', 'Administration'],
  ['api', 'API'],
]

const internalCategories = [
  ['hr', 'HR & People'],
  ['security-compliance', 'Security & Compliance'],
  ['sales', 'Sales'],
  ['customer-success', 'Customer Success'],
  ['engineering', 'Engineering'],
  ['finance', 'Finance'],
]

const productId = (s: string) => `product.${s}`
const topicId = (s: string) => `topic.${s}`
const icId = (s: string) => `internalCategory.${s}`

// --- Content --------------------------------------------------------------

type Article = {
  id: string
  title: string
  summary: string
  body: Para[]
  products?: string[]
  topics?: string[]
  audience?: string[]
  status?: string
  review?: string | null
}

const helpArticles: Article[] = [
  {
    id: 'getting-started',
    title: 'Getting started with Beacon',
    summary:
      'Create your account, invite your team, and send a first test message in under ten minutes.',
    body: [
      'Beacon is a customer engagement platform for sending coordinated email, push, SMS, and in-app messages from a single audience model.',
      'After signing up, verify your sending domain and invite teammates from the Administration panel. You can send a test message before connecting any production data.',
    ],
    topics: ['getting-started'],
    audience: [],
    review: at(OVERDUE[0]),
  },
  {
    id: 'first-campaign',
    title: 'Creating your first campaign',
    summary: 'Walk through building, previewing, and scheduling a one-time email campaign.',
    body: [
      'A campaign is a single coordinated send to a chosen segment. Start from Campaigns → New campaign and pick a channel.',
      {bullet: 'Choose an audience segment as the recipient list.'},
      {bullet: 'Compose your content and send yourself a preview.'},
      {bullet: 'Schedule the send or publish immediately.'},
    ],
    products: ['campaigns'],
    topics: ['getting-started'],
    audience: ['end-user'],
    review: at(FRESH[0]),
  },
  {
    id: 'building-segments',
    title: 'Building audience segments',
    summary:
      'Use rule-based filters to build segments that update automatically as contact data changes.',
    body: [
      'Segments are live: contacts enter and leave automatically as they match your filter rules. This keeps targeting accurate without manual list maintenance.',
      'Combine attribute filters (such as plan tier) with behavioral filters (such as last activity) using AND/OR logic.',
    ],
    products: ['segments'],
    topics: ['administration'],
    audience: ['admin'],
    review: at(OVERDUE[1]),
  },
  {
    id: 'connecting-email',
    title: 'Connecting an email channel',
    summary:
      'Authenticate your sending domain with SPF, DKIM, and DMARC for reliable email delivery.',
    body: [
      'Before sending production email, authenticate your domain. Beacon generates the DNS records you add at your provider.',
      'Authentication protects deliverability and is required before you can remove the Beacon sending subdomain.',
    ],
    products: ['channels'],
    topics: ['integrations'],
    audience: ['admin'],
    review: at(FRESH[1]),
  },
  {
    id: 'push-setup',
    title: 'Setting up push notifications',
    summary: 'Register your mobile app credentials and send your first push notification.',
    body: [
      'Push requires uploading your APNs key (iOS) and FCM credentials (Android) in Channels → Push.',
      'Once registered, push becomes available as a channel in campaigns and workflows.',
    ],
    products: ['channels'],
    topics: ['integrations'],
    audience: ['admin'],
    review: null,
  },
  {
    id: 'campaign-analytics',
    title: 'Understanding campaign analytics',
    summary: 'Read delivery, open, click, and conversion metrics and learn what each one measures.',
    body: [
      'Each campaign reports delivery, engagement, and conversion metrics. Conversions are attributed to goals you define per campaign.',
      'Use the comparison view to benchmark a campaign against your rolling 30-day average.',
    ],
    products: ['analytics'],
    topics: ['getting-started'],
    audience: ['end-user'],
    review: at(FRESH[2]),
  },
  {
    id: 'workflows-intro',
    title: 'Automating with Workflows',
    summary:
      'Build event-triggered journeys that send the right message at the right step automatically.',
    body: [
      'A workflow is a branching journey triggered by an event, such as a signup or an abandoned cart.',
      'Add delays, conditional splits, and channel steps to coordinate messages across days or weeks.',
    ],
    products: ['workflows'],
    topics: ['administration'],
    audience: ['admin'],
    review: at(OVERDUE[2]),
  },
  {
    id: 'api-quickstart',
    title: 'Beacon API quickstart',
    summary: 'Make your first authenticated API call and track a custom event in minutes.',
    body: [
      'The Beacon REST API lets you sync contacts, trigger events, and read analytics programmatically.',
      'All requests use HTTPS and a Bearer token. Track an event by POSTing to the events endpoint with a contact identifier.',
    ],
    products: ['api'],
    topics: ['api'],
    audience: ['developer'],
    review: at(FRESH[3]),
  },
  {
    id: 'api-keys',
    title: 'Authentication and API keys',
    summary:
      'Create, scope, and rotate API keys, and follow best practices for storing them securely.',
    body: [
      'Create API keys in Administration → API keys. Scope each key to the minimum permissions it needs.',
      'Rotate keys periodically and never embed a secret key in client-side code.',
    ],
    products: ['api'],
    topics: ['security'],
    audience: ['developer'],
    review: at(OVERDUE[3]),
  },
  {
    id: 'team-roles',
    title: 'Managing team members and roles',
    summary: 'Invite teammates and assign roles that control who can edit, send, and administer.',
    body: [
      'Roles range from Viewer to Admin. Only Admins can manage billing, API keys, and member roles.',
      'Use the Editor role for content authors who should not change account settings.',
    ],
    topics: ['administration'],
    audience: ['admin'],
    review: at(FRESH[4]),
  },
  {
    id: 'billing-overview',
    title: 'Billing and subscription overview',
    summary: 'Understand how Beacon plans, usage, and invoices work, and where to manage them.',
    body: [
      'Beacon bills on a monthly plan plus usage above your included message volume.',
      'View invoices and update payment methods in Administration → Billing. Admins receive renewal reminders by email.',
    ],
    topics: ['billing'],
    audience: ['admin'],
    review: at(OVERDUE[4]),
  },
  {
    id: 'delivery-troubleshooting',
    title: 'Troubleshooting delivery issues',
    summary:
      'Diagnose bounces, throttling, and spam placement, and learn the first steps to resolve each.',
    body: [
      'If messages are not arriving, check the delivery log for bounce and rejection reasons first.',
      'Hard bounces indicate invalid addresses; soft bounces are temporary. Persistent spam placement usually points to a domain authentication gap.',
    ],
    products: ['channels'],
    topics: ['troubleshooting'],
    audience: ['end-user'],
    review: null,
  },
  {
    id: 'importing-contacts',
    title: 'Importing contacts',
    summary:
      'Bring existing contacts into Beacon via CSV or the API, with consent fields mapped correctly.',
    body: [
      'Import contacts from Segments → Import. Map your columns to Beacon attributes, including a consent status.',
      'Only import contacts who have opted in. Beacon honors consent fields when building segments.',
    ],
    products: ['segments'],
    topics: ['getting-started'],
    audience: ['admin'],
    review: at(FRESH[0]),
  },
  {
    id: 'webhooks',
    title: 'Webhooks and event streaming',
    summary:
      'Subscribe to delivery and engagement events and receive them at your own endpoint in real time.',
    body: [
      'Webhooks deliver events such as sends, opens, clicks, and unsubscribes to an HTTPS endpoint you control.',
      'Verify the signature header on each request to confirm it originated from Beacon.',
    ],
    products: ['api'],
    topics: ['integrations'],
    audience: ['developer'],
    review: at(OVERDUE[5]),
  },
  {
    id: 'data-exports',
    title: 'Data retention and exports',
    summary: 'Configure how long Beacon retains event data and how to export it on demand.',
    body: [
      'Event data is retained per your plan. Admins can configure shorter retention windows for compliance.',
      'Request a full export from Administration → Data; large exports are delivered as a downloadable archive.',
    ],
    topics: ['security', 'administration'],
    audience: ['admin'],
    status: 'draft',
    review: null,
  },
]

type Faq = {
  id: string
  question: string
  answer: Para[]
  products?: string[]
  topics?: string[]
  audience?: string[]
  status?: string
  review?: string | null
}

const faqs: Faq[] = [
  {
    id: 'reset-password',
    question: 'How do I reset my password?',
    answer: [
      'Use the "Forgot password" link on the sign-in page. A reset link is emailed to your account address and expires after one hour.',
    ],
    topics: ['security'],
    audience: ['end-user'],
    review: at(FRESH[0]),
  },
  {
    id: 'emails-spam',
    question: 'Why are my emails going to spam?',
    answer: [
      'The most common cause is incomplete domain authentication. Confirm SPF, DKIM, and DMARC are set, and warm up new sending domains gradually.',
    ],
    products: ['channels'],
    topics: ['troubleshooting'],
    audience: ['end-user'],
    review: at(OVERDUE[0]),
  },
  {
    id: 'segment-vs-list',
    question: "What's the difference between a segment and a list?",
    answer: [
      'A list is static and only changes when you add or remove contacts manually. A segment is rule-based and updates automatically as contact data changes.',
    ],
    products: ['segments'],
    topics: ['administration'],
    audience: ['end-user'],
    review: at(FRESH[1]),
  },
  {
    id: 'billing-calculated',
    question: 'How is billing calculated?',
    answer: [
      'Your monthly plan includes a message volume. Usage above that is billed per thousand messages at your plan rate, shown on each invoice.',
    ],
    topics: ['billing'],
    audience: ['admin'],
    review: at(OVERDUE[1]),
  },
  {
    id: 'schedule-campaigns',
    question: 'Can I schedule campaigns in advance?',
    answer: [
      'Yes. When sending a campaign, choose "Schedule" and pick a date and time. You can also send in each recipient’s local time zone.',
    ],
    products: ['campaigns'],
    topics: ['getting-started'],
    audience: ['end-user'],
    review: at(FRESH[2]),
  },
  {
    id: 'rate-limits',
    question: 'What API rate limits apply?',
    answer: [
      'The default limit is 100 requests per second per project. Exceeding it returns a 429 response with a Retry-After header.',
    ],
    products: ['api'],
    topics: ['api'],
    audience: ['developer'],
    review: at(OVERDUE[2]),
  },
  {
    id: 'enable-2fa',
    question: 'How do I enable two-factor authentication?',
    answer: [
      'Open your profile settings and choose Security → Two-factor authentication. Authenticator apps and SMS codes are both supported.',
    ],
    topics: ['security'],
    audience: [],
    review: at(FRESH[3]),
  },
  {
    id: 'supported-integrations',
    question: 'Which integrations does Beacon support?',
    answer: [
      'Beacon connects to common data warehouses, CRMs, and analytics tools, plus a generic webhook and REST API for everything else.',
    ],
    topics: ['integrations'],
    audience: ['admin'],
    review: null,
  },
  {
    id: 'export-analytics',
    question: 'How do I export analytics data?',
    answer: [
      'From any report, choose Export to download a CSV, or use the analytics API endpoints to pull metrics programmatically.',
    ],
    products: ['analytics'],
    topics: ['administration'],
    audience: ['admin'],
    review: at(FRESH[4]),
  },
  {
    id: 'downgrade-plan',
    question: 'What happens when I downgrade my plan?',
    answer: [
      'Downgrades take effect at your next renewal. Features above your new plan stop at that date, and your included message volume adjusts accordingly.',
    ],
    topics: ['billing'],
    audience: ['admin'],
    review: at(OVERDUE[3]),
  },
]

type Internal = {
  id: string
  title: string
  summary: string
  body: Para[]
  category: string
  importance: 'standard' | 'critical'
  products?: string[]
  topics?: string[]
  audience?: string[]
  status?: string
  review?: string | null
}

const playbooks: Internal[] = [
  {
    id: 'billing-dispute',
    title: 'Tier 1 billing dispute escalation',
    summary:
      'How support reps handle a customer disputing a charge, and when to escalate to Finance.',
    body: [
      'Confirm the disputed invoice and the usage that drove it before responding. Reference the customer-facing billing article for the calculation.',
      {bullet: 'If the dispute is under $500 and clearly an error, issue a credit and log it.'},
      {
        bullet:
          'If over $500 or contested, escalate to Finance with the invoice ID and account notes.',
      },
    ],
    category: 'customer-success',
    importance: 'critical',
    topics: ['billing'],
    review: at(OVERDUE[0]),
  },
  {
    id: 'onboarding-motion',
    title: 'New customer onboarding motion',
    summary: 'The standard 30-day onboarding sequence for new mid-market accounts.',
    body: [
      'Onboarding spans three milestones: domain authentication, first campaign sent, and first workflow live.',
      'Schedule a kickoff within 48 hours of close and a check-in at day 14.',
    ],
    category: 'customer-success',
    importance: 'standard',
    review: at(FRESH[0]),
  },
  {
    id: 'deliverability-complaint',
    title: 'Handling a deliverability complaint',
    summary: 'Steps to diagnose and respond when a customer reports poor inbox placement.',
    body: [
      'Pull the customer’s recent sending stats and authentication status before responding.',
      'Most complaints trace to missing DMARC or an un-warmed domain; provide the remediation steps and offer a deliverability review for enterprise accounts.',
    ],
    category: 'customer-success',
    importance: 'standard',
    products: ['channels'],
    review: at(OVERDUE[1]),
  },
  {
    id: 'competitive-esp',
    title: 'Competitive response: vs. legacy ESPs',
    summary:
      'Positioning and proof points when a prospect is evaluating Beacon against a legacy email service provider.',
    body: [
      'Lead with the unified audience model: legacy ESPs treat email in isolation, while Beacon coordinates email, push, SMS, and in-app from one segment.',
      'Avoid disparaging competitors; anchor on the cost of maintaining separate tools and lists.',
    ],
    category: 'sales',
    importance: 'standard',
    review: at(FRESH[1]),
  },
  {
    id: 'objection-pricing',
    title: 'Objection handling: pricing',
    summary: 'Common pricing objections and the framing that reframes cost as consolidated value.',
    body: [
      'When price comes up, reframe around tools replaced and headcount saved on list maintenance.',
      'Offer an annual commitment for a volume discount rather than discounting the monthly rate.',
    ],
    category: 'sales',
    importance: 'standard',
    review: null,
  },
  {
    id: 'security-incident',
    title: 'Security incident triage runbook',
    summary: 'First-responder steps for engineers when a potential security incident is reported.',
    body: [
      'Acknowledge the report, open an incident channel, and assign an incident lead within 15 minutes.',
      {bullet: 'Contain: revoke affected credentials and isolate impacted systems.'},
      {bullet: 'Notify Security & Compliance; do not communicate externally until cleared.'},
    ],
    category: 'engineering',
    importance: 'critical',
    topics: ['security'],
    review: at(OVERDUE[2]),
  },
  {
    id: 'enterprise-demo',
    title: 'Enterprise demo script',
    summary: 'The reference demo flow for enterprise prospects, emphasizing governance and scale.',
    body: [
      'Open with the unified audience, then show a cross-channel workflow and the analytics that tie back to revenue.',
      'For enterprise, spend time on roles, audit logging, and data residency.',
    ],
    category: 'sales',
    importance: 'standard',
    review: at(FRESH[2]),
  },
  {
    id: 'churn-save',
    title: 'Churn-risk save play',
    summary:
      'How CSMs respond to an at-risk account showing declining usage or a cancellation signal.',
    body: [
      'Trigger this play when usage drops more than 40% month over month or a cancellation is requested.',
      'Lead with a value review tied to the customer’s original goals, and bring a tailored workflow recommendation.',
    ],
    category: 'customer-success',
    importance: 'critical',
    review: at(FRESH[3]),
  },
]

const policies: Internal[] = [
  {
    id: 'data-privacy',
    title: 'Data processing and privacy policy',
    summary:
      'How Beacon processes, stores, and protects customer and contact data, and our regulatory commitments.',
    body: [
      'Beacon processes contact data solely to provide the service and acts as a processor on behalf of customers.',
      'Data is encrypted in transit and at rest. Sub-processors are reviewed annually and listed in the trust center.',
    ],
    category: 'security-compliance',
    importance: 'critical',
    topics: ['security'],
    review: at(OVERDUE[0]),
  },
  {
    id: 'refund-policy',
    title: 'Refund and credit policy',
    summary: 'When refunds and account credits are issued, and the approval thresholds for each.',
    body: [
      'Credits under $500 may be approved by support. Refunds and credits above that require Finance approval.',
      'Refunds are issued to the original payment method within ten business days.',
    ],
    category: 'finance',
    importance: 'critical',
    topics: ['billing'],
    review: at(FRESH[0]),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use policy',
    summary:
      'Prohibited content and sending practices that protect platform deliverability and reputation.',
    body: [
      'Customers must send only to contacts who have opted in and must honor unsubscribe requests promptly.',
      'Purchased lists, deceptive subject lines, and prohibited content categories are not permitted.',
    ],
    category: 'security-compliance',
    importance: 'standard',
    review: at(OVERDUE[1]),
  },
  {
    id: 'pto-policy',
    title: 'PTO and leave policy',
    summary: 'How paid time off, sick leave, and parental leave are accrued and requested.',
    body: [
      'Full-time employees accrue paid time off monthly. Requests are submitted through the HR portal at least two weeks ahead where possible.',
      'Parental and medical leave follow local statutory minimums or company policy, whichever is greater.',
    ],
    category: 'hr',
    importance: 'standard',
    review: at(FRESH[1]),
  },
  {
    id: 'vendor-security',
    title: 'Vendor security review policy',
    summary: 'The security review every new sub-processor or vendor must pass before approval.',
    body: [
      'New vendors handling customer data must complete a security questionnaire and provide a current compliance report.',
      'Security & Compliance signs off before any data is shared; high-risk vendors require an annual re-review.',
    ],
    category: 'security-compliance',
    importance: 'critical',
    review: null,
  },
]

// --- Agent Context configs ------------------------------------------------

const EXTERNAL_INSTRUCTIONS = `# Customer Support context

## Rules
- Answer only from published help articles and FAQs. If the content does not cover a question, say so and suggest contacting support.
- Never speculate about account-specific data (invoices, usage, personal details) — direct the user to their account or support.
- Prefer the most recently reviewed content when answers conflict.

## Schema notes
- helpArticle: procedural help. Use \`summary\` for cards and \`pt::text(content)\` for the full body.
- faq: a tight question/answer pair. Use \`pt::text(answer)\` for the body.
- product and topic: taxonomy you can use to scope or label results.

## Query patterns
- Route by audience when relevant: \`*[_type in ["helpArticle","faq"] && $audience in audience[]]\`.
- Hybrid retrieval: \`*[_type in ["helpArticle","faq"]] | score(text::semanticSimilarity("content", $query)) | order(_score desc)[0...5]\`.

## Content filter
Scoped to external types only — internal playbooks and policies are never visible here.`

const INTERNAL_INSTRUCTIONS = `# Team KB context

## Rules
- You can see both customer-facing content (helpArticle, faq) and internal content (playbook, policy). In one answer, give the customer-facing fact and the internal procedure together.
- Surface \`importance == "critical"\` playbooks and policies first.
- Warn when content is overdue for review (\`reviewByDate < now()\`) so staff know it may be stale.

## Schema notes
- playbook: internal how-to for customer-facing teams; has \`importance\` and an \`internalCategory\` reference.
- policy: internal rules and governance; \`importance == "critical"\` matters most.
- internalCategory: organizes internal content (HR, Security & Compliance, Sales, etc.).

## Query patterns
- Cross-context answer: query both external and internal types for the same topic and combine.
- Traverse categories: \`*[_type == "playbook" && internalCategory->slug.current == $category]\`.
- Hybrid retrieval works across all types via \`score(text::semanticSimilarity(...))\`.

## Content filter
Scoped to all content and taxonomy types — this is the internal, staff-only context.`

// --- Emit -----------------------------------------------------------------

type Doc = Record<string, unknown>
const docs: Doc[] = []

for (const [slug, title, description] of products) {
  docs.push({
    _id: productId(slug),
    _type: 'product',
    title,
    slug: {_type: 'slug', current: slug},
    description,
  })
}
for (const [slug, title] of topics) {
  docs.push({_id: topicId(slug), _type: 'topic', title, slug: {_type: 'slug', current: slug}})
}
for (const [slug, title] of internalCategories) {
  docs.push({
    _id: icId(slug),
    _type: 'internalCategory',
    title,
    slug: {_type: 'slug', current: slug},
  })
}

for (const a of helpArticles) {
  docs.push({
    _id: `helpArticle.${a.id}`,
    _type: 'helpArticle',
    title: a.title,
    slug: {_type: 'slug', current: a.id},
    summary: a.summary,
    content: pt(a.body),
    audience: a.audience ?? [],
    products: (a.products ?? []).map((s) => ({_key: key(), ...ref(productId(s))})),
    topics: (a.topics ?? []).map((s) => ({_key: key(), ...ref(topicId(s))})),
    status: a.status ?? 'published',
    ...(a.review ? {reviewByDate: a.review} : {}),
  })
}

for (const f of faqs) {
  docs.push({
    _id: `faq.${f.id}`,
    _type: 'faq',
    question: f.question,
    answer: pt(f.answer),
    audience: f.audience ?? [],
    products: (f.products ?? []).map((s) => ({_key: key(), ...ref(productId(s))})),
    topics: (f.topics ?? []).map((s) => ({_key: key(), ...ref(topicId(s))})),
    status: f.status ?? 'published',
    ...(f.review ? {reviewByDate: f.review} : {}),
  })
}

const emitInternal = (type: 'playbook' | 'policy', items: Internal[]) => {
  for (const it of items) {
    docs.push({
      _id: `${type}.${it.id}`,
      _type: type,
      title: it.title,
      slug: {_type: 'slug', current: it.id},
      summary: it.summary,
      content: pt(it.body),
      audience: it.audience ?? [],
      products: (it.products ?? []).map((s) => ({_key: key(), ...ref(productId(s))})),
      topics: (it.topics ?? []).map((s) => ({_key: key(), ...ref(topicId(s))})),
      internalCategory: ref(icId(it.category)),
      importance: it.importance,
      status: it.status ?? 'published',
      ...(it.review ? {reviewByDate: it.review} : {}),
    })
  }
}
emitInternal('playbook', playbooks)
emitInternal('policy', policies)

docs.push({
  _id: 'agentContext.external',
  _type: 'sanity.agentContext',
  version: '1',
  name: 'Customer Support',
  slug: {_type: 'slug', current: 'customer-support'},
  groqFilter: '_type in ["helpArticle", "faq", "product", "topic"]',
  instructions: EXTERNAL_INSTRUCTIONS,
})
docs.push({
  _id: 'agentContext.internal',
  _type: 'sanity.agentContext',
  version: '1',
  name: 'Team KB',
  slug: {_type: 'slug', current: 'team-kb'},
  groqFilter:
    '_type in ["helpArticle", "faq", "playbook", "policy", "product", "topic", "internalCategory"]',
  instructions: INTERNAL_INSTRUCTIONS,
})

const out = fileURLToPath(new URL('../seed/data.ndjson', import.meta.url))
writeFileSync(out, docs.map((d) => JSON.stringify(d)).join('\n') + '\n')
console.log(`Wrote ${docs.length} documents to ${out}`)
