// Generates studio/seed/data.ndjson for the fictional Beacon customer
// engagement platform. Run: pnpm --filter studio seed:generate
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

const OVERDUE = ['2026-01-15', '2026-02-20', '2026-03-10']
const FRESH = ['2026-10-15', '2026-11-01', '2026-12-01']
const at = (d: string) => `${d}T00:00:00Z`

const products = [
  {
    slug: 'campaigns',
    title: 'Campaigns',
    description: 'Design, schedule, and send multi-channel campaigns from one audience model.',
    planTier: 'growth',
    priceMonthly: 149,
    channels: ['email', 'sms', 'push'],
    seatLimit: 10,
    features: ['A/B tests', 'local send time', 'preview inbox'],
  },
  {
    slug: 'segments',
    title: 'Segments',
    description: 'Live, rule-based audience segments that update as contact data changes.',
    planTier: 'starter',
    priceMonthly: 49,
    channels: ['email'],
    seatLimit: 5,
    features: ['Attribute filters', 'CSV import', 'consent fields'],
  },
  {
    slug: 'channels',
    title: 'Channels',
    description: 'Email, SMS, push, and in-app delivery with shared authentication.',
    planTier: 'growth',
    priceMonthly: 199,
    channels: ['email', 'sms', 'push', 'in-app'],
    seatLimit: 15,
    features: ['SPF/DKIM/DMARC wizard', 'delivery logs', 'suppression lists'],
  },
  {
    slug: 'analytics',
    title: 'Analytics',
    description: 'Engagement, conversion, and deliverability reporting across campaigns.',
    planTier: 'enterprise',
    priceMonthly: 399,
    channels: ['email', 'sms', 'push', 'in-app'],
    seatLimit: 50,
    features: ['Conversion goals', 'cohort compare', 'CSV and API export'],
  },
  {
    slug: 'workflows',
    title: 'Workflows',
    description: 'Event-triggered journeys with delays, splits, and multi-channel steps.',
    planTier: 'growth',
    priceMonthly: 179,
    channels: ['email', 'sms', 'push', 'in-app'],
    seatLimit: 20,
    features: ['Event triggers', 'conditional splits', 'wait steps'],
  },
  {
    slug: 'api',
    title: 'Developer API',
    description: 'REST API, webhooks, and event streaming for contacts and metrics.',
    planTier: 'enterprise',
    priceMonthly: 299,
    channels: ['email', 'sms', 'push'],
    seatLimit: 0,
    features: ['100 rps default', 'signed webhooks', 'scoped API keys'],
  },
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

type Article = {
  id: string
  title: string
  summary: string
  body: Para[]
  products?: string[]
  topics?: string[]
  audience?: string[]
  status?: string
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
  },
  {
    id: 'paused-workflow-billing',
    title: 'Billing for paused campaigns and workflows',
    summary:
      'What happens to audience membership and usage when you pause a campaign or a workflow.',
    body: [
      {
        style: 'h2',
        text: 'Paused campaigns',
      },
      'Pausing a scheduled campaign stops the remaining send. Contacts already delivered stay in reporting. Contacts not yet sent are not billed for that send.',
      {
        style: 'h2',
        text: 'Paused workflows',
      },
      'A paused workflow keeps enrolled contacts in place. Those contacts still count toward your included audience while the workflow is paused. They are not billed for messages that the pause prevented.',
      'Resume the workflow to continue from each contact’s last completed step. Restarting a workflow from the beginning is a separate action and may re-bill message volume.',
    ],
    products: ['campaigns', 'workflows'],
    topics: ['billing'],
    audience: ['admin'],
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
  },
  {
    id: 'refunds-and-credits',
    title: 'Refunds and credits',
    summary: 'When Beacon issues refunds or account credits, and the 30-day request window.',
    body: [
      'You can request a refund or account credit within 30 days of the original invoice date.',
      'Qualifying charges include unused prepaid volume and billing errors. Message volume already delivered is not refundable.',
      'Refunds return to the original payment method within ten business days. Credits apply to the next invoice.',
    ],
    topics: ['billing'],
    audience: ['admin'],
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
}

const faqs: Faq[] = [
  {
    id: 'refund-window',
    question: 'What is the refund window?',
    answer: [
      'Beacon issues refunds for qualifying charges within 30 days of the original invoice date. Delivered message volume is not refundable.',
    ],
    topics: ['billing'],
    audience: ['admin'],
  },
  {
    id: 'reset-password',
    question: 'How do I reset my password?',
    answer: [
      'Use the "Forgot password" link on the sign-in page. A reset link is emailed to your account address and expires after one hour.',
    ],
    topics: ['security'],
    audience: ['end-user'],
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
  },
  {
    id: 'billing-calculated',
    question: 'How is billing calculated?',
    answer: [
      'Your monthly plan includes a message volume. Usage above that is billed per thousand messages at your plan rate, shown on each invoice.',
    ],
    topics: ['billing'],
    audience: ['admin'],
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
  },
  {
    id: 'enable-2fa',
    question: 'How do I enable two-factor authentication?',
    answer: [
      'Open your profile settings and choose Security → Two-factor authentication. Authenticator apps and SMS codes are both supported.',
    ],
    topics: ['security'],
  },
  {
    id: 'supported-integrations',
    question: 'Which integrations does Beacon support?',
    answer: [
      'Beacon connects to common data warehouses, CRMs, and analytics tools, plus a generic webhook and REST API for everything else.',
    ],
    topics: ['integrations'],
    audience: ['admin'],
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
  },
  {
    id: 'downgrade-plan',
    question: 'What happens when I downgrade my plan?',
    answer: [
      'Downgrades take effect at your next renewal. Features above your new plan stop at that date, and your included message volume adjusts accordingly.',
    ],
    topics: ['billing'],
    audience: ['admin'],
  },
]

type Policy = {
  id: string
  title: string
  summary: string
  body: Para[]
  category: string
  importance: 'standard' | 'critical'
  owner: string
  review?: string | null
}

const policies: Policy[] = [
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
    owner: 'Security & Compliance',
    review: at(OVERDUE[0]),
  },
  {
    id: 'refund-policy',
    title: 'Refund and credit policy',
    summary: 'When refunds and account credits are issued, and the approval thresholds for each.',
    body: [
      'The customer-facing refund window is 30 days from the original invoice date. That is ground truth if a file or article disagrees.',
      'Credits under $500 may be approved by support. Refunds and credits above that require Finance approval.',
      'Refunds are issued to the original payment method within ten business days.',
    ],
    category: 'finance',
    importance: 'critical',
    owner: 'Finance',
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
    owner: 'Security & Compliance',
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
    owner: 'People',
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
    owner: 'Security & Compliance',
    review: null,
  },
]

type Doc = Record<string, unknown>
const docs: Doc[] = []

for (const product of products) {
  docs.push({
    _id: productId(product.slug),
    _type: 'product',
    title: product.title,
    slug: {_type: 'slug', current: product.slug},
    description: product.description,
    planTier: product.planTier,
    priceMonthly: product.priceMonthly,
    channels: product.channels,
    seatLimit: product.seatLimit,
    features: product.features,
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
  })
}

for (const it of policies) {
  docs.push({
    _id: `policy.${it.id}`,
    _type: 'policy',
    title: it.title,
    slug: {_type: 'slug', current: it.id},
    summary: it.summary,
    content: pt(it.body),
    internalCategory: ref(icId(it.category)),
    importance: it.importance,
    status: 'published',
    owner: it.owner,
    ...(it.review ? {reviewByDate: it.review} : {}),
  })
}

const out = fileURLToPath(new URL('../seed/data.ndjson', import.meta.url))
writeFileSync(out, docs.map((d) => JSON.stringify(d)).join('\n') + '\n')
console.log(`Wrote ${docs.length} documents to ${out}`)
