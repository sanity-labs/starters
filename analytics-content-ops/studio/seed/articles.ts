export type SeedArticle = {
  slug: string
  title: string
  dek: string
  authors: string[]
  publishedAt: string
  category: string
  image: string
  sourceUrl: string
  body: string[]
}

// Real articles published on the Sanity blog (sanity.io/blog), presented within
// the Friluft Media demo. Source links point to the originals.
export const articles: SeedArticle[] = [
  {
    slug: 'we-dont-write-code-anymore',
    title: "We don't write code anymore",
    dek: 'An engineering manager’s field report from an AI-first engineering team.',
    authors: ['Vincent Quigley'],
    publishedAt: '2026-06-12',
    category: 'Engineering',
    image: 'ridge-hiker.png',
    sourceUrl: 'https://www.sanity.io/blog/we-dont-write-code-anymore',
    body: [
      'Something has shifted in software engineering. Not in the abstract, future-of-work sense. In the daily mechanics of how code gets planned, produced, reviewed, shipped, and monitored. I think we are now in the fourth generation of coding. The deliberately uncomfortable version is that we no longer write code.',
      "I'm Vincent, an engineering manager at Sanity who still codes, and I have been using AI in engineering work for about 2.5 years. Over the last few months, my team has become AI-first; we build, release, and monitor software with AI as the main working surface. Code still gets produced. Pull requests still get reviewed. Systems still ship. What has changed is the job's center.",
      'A few weeks ago, I asked the team how much code they still write by hand. This is a team of senior engineers, each with at least 10 years of experience. One person said 1%. Another said they had tried writing code directly, then found themselves going back to the agent because it no longer felt like the intuitive path. That can sound scary. I do not think it needs to be.',
      'For decades, writing code was one of the most expensive parts of software engineering. We built our habits around that cost. Those activities still matter. In some cases, they matter more. But the reason for them has changed. Writing code was never the point. Creating useful products and services for customers was the point. Code was the cost of getting there.',
      'When implementation stops being the bottleneck, the development pipeline reorganizes around context, autonomy, and review. Before an agent writes code, I need to tell it what matters: the goal, constraints, existing patterns, edge cases, success criteria, and the boundaries of the change. The first output is often not code. It is a plan or spec that I can review, challenge, and share with others.',
      'One rule matters more than almost anything else: keep reviews small. I train agents to produce small pull requests, ideally around 500 lines. If it becomes 10,000, the process has failed. No one is reviewing that properly. The review bar cannot drop just because the code was cheap to produce.',
      'The work did not disappear. It moved up a level. For engineers, the valuable skills are judgment, taste, verification, product thinking, and systems thinking. Syntax still matters, but it is not enough. Knowing what good looks like matters more. The teams that benefit most will not be the ones that generate the most code. They will be the ones who make better decisions faster.',
    ],
  },
  {
    slug: 'how-to-write-for-an-agent',
    title: 'How to write for an agent',
    dek: 'Spoiler: it’s not prompting. It’s an old craft for a very new kind of reader.',
    authors: ['Knut Melvær', 'Even Westvang'],
    publishedAt: '2026-03-18',
    category: 'Guide',
    image: 'pine-forest.png',
    sourceUrl: 'https://www.sanity.io/blog/how-to-write-for-an-agent',
    body: [
      'Imagine waking up. You can’t really see. You don’t know where you are, exactly what year it is, or actually, if you even have limbs right now. But you remember, with varying accuracy, every book and web page in the entire world. This is how most agents are instructed today. Commands shouted into the void. Rules stacked on rules. And then surprise when the output feels generic.',
      'There’s a difference between prompting and writing for agents. Prompting agents is what users do. You open a chat, ask a question, get an answer. Writing for agents is what builders do. You’re writing system prompts that define who the agent is, what it knows, how it behaves. The user never sees this text. But it shapes every interaction they’ll have.',
      'Every writer, whether they know it or not, needs to construct an implied reader. System prompts are the same. You’re constructing a reader. That reader happens to be an LLM, and LLMs are weird readers. It just woke up, with no memory of previous conversations. Most importantly: it really wants to help. If your instructions are unclear, it will guess.',
      'At Sanity, we’ve been building schema-aware AI products since 2023. Here’s what we’ve learned. Write like you’re onboarding a new colleague. Cut before you add — most system prompts are too long, not too short. Don’t shout; your tone carries through. One topic, one place. Show, don’t tell: one good example beats ten rules. Read it out loud.',
      'None of this is new. The specific skill is constructing a reader — figuring out their mental model, what context they’re missing, what language will land. Writers have always done this. The secret to good agents isn’t better code. It’s better writing. And better writing is a craft that people have been practicing, and teaching, for a very long time.',
    ],
  },
  {
    slug: 'structure-powers-intelligence',
    title: 'Structure powers intelligence',
    dek: 'AI agents need structure, not scattered docs. Build the foundation now or clean up later.',
    authors: ['Magnus Hillestad'],
    publishedAt: '2026-03-03',
    category: 'Content Strategy',
    image: 'coast-archipelago.png',
    sourceUrl: 'https://www.sanity.io/blog/structure-powers-intelligence',
    body: [
      'Not long ago, content used to be something you published. Now it’s something your systems run on. When an AI agent answers a customer’s question, it isn’t reading your website; it’s reaching for whatever context it can find and acting on it. Content has become context. And context has become infrastructure.',
      'You’ve heard this before. Just connect your Google Drive, your Notion workspace, and your internal wiki, and let the agents figure it out. It won’t. We keep seeing the same story. A team launches an AI assistant, then it starts hallucinating. Eventually someone realizes the problem was never the model; it was that their product information lived in 47 different documents, none authoritative.',
      'Agents don’t just need access to information. They need precise context they can act on. There’s a difference between handing someone a pile of papers and giving them an API. Structured content means knowing. You can query a deterministic answer. The agent isn’t interpreting. It’s operating.',
      'Start with the foundation. At the center is your system of record, where content and business logic are modeled clearly and deliberately. Around that foundation, humans and agents work together. Agents handle the routine; humans handle the exceptions, the decisions that actually matter.',
      'This is the architecture that’s emerging. Not a CMS with AI features bolted on. Something purpose-built for the world where content requires structure, where humans and AI collaborate, where content powers intelligence. Content has become context. Structure powers intelligence. The question is whether you’re building that structure or cleaning up after agents that guessed.',
    ],
  },
  {
    slug: 'skills-are-how-your-company-works',
    title: 'Skills are how your company works, written down for agents',
    dek: 'How we built an internal skills platform on Sanity, so anyone can author what our agents know — not just engineers.',
    authors: ['Knut Melvær'],
    publishedAt: '2026-06-22',
    category: 'Digital Strategy',
    image: 'aurora.png',
    sourceUrl: 'https://www.sanity.io/blog/skills-are-how-your-company-works',
    body: [
      'The knowledge that makes a company work rarely lives in one place. It’s spread across people, habits, half-written docs, and the muscle memory of whoever has been around longest. When you start handing work to agents, that diffuse knowledge suddenly becomes a bottleneck.',
      'We built an internal skills platform on Sanity so anyone at the company can author what our agents know. The point is that authoring skills should not require writing code. A skill is a written-down way of working — the steps, the context, the guardrails — modeled as structured content that both people and agents can read.',
      'Because it’s structured, the same skill can power an agent in Slack, a workflow in the Studio, or a script running on a schedule. Governance is built in: you know who changed what, when, and why. The result is that the people closest to the work can shape how agents behave, without waiting on an engineering queue.',
    ],
  },
  {
    slug: 'how-to-get-product-feedback-from-agents',
    title: 'How to get product feedback from agents',
    dek: 'Agents are some of Sanity’s heaviest users, but none of them report bugs. Here’s how we started listening.',
    authors: ['Jon Eide Johnsen'],
    publishedAt: '2026-06-18',
    category: 'Engineering',
    image: 'kayak-fjord.png',
    sourceUrl: 'https://www.sanity.io/blog/how-to-get-product-feedback-from-agents',
    body: [
      'Agents are some of our heaviest users. They call our APIs thousands of times a day, hit edge cases humans rarely reach, and stress the product in ways no manual QA pass would. And yet none of them ever file a bug report.',
      'That’s a strange gap. The users who exercise your product the hardest are also the quietest. So we started treating agent behavior as a feedback channel of its own — logging where agents retry, where they get confused, and where they give up.',
      'The patterns are surprisingly legible. When an agent repeatedly rephrases the same query, something about the interface is unclear. When it abandons a task, there’s usually a missing capability or an ambiguous response. Reading those receipts turns silent, high-volume usage into a steady stream of product signal.',
    ],
  },
  {
    slug: 'sanity-studio-v6',
    title: 'Sanity Studio v6: A focused upgrade',
    dek: 'Builds got 2–9× faster on Vite 8 in our testing, with improvements to search and custom auth.',
    authors: ['Bjørge Næss'],
    publishedAt: '2026-06-09',
    category: 'Product',
    image: 'mountain-cabin.png',
    sourceUrl: 'https://www.sanity.io/blog/sanity-studio-v6',
    body: [
      'Sanity Studio v6 is a focused upgrade. The headline is speed: builds got 2–9× faster on Vite 8 in our testing, which changes how quickly you can iterate on a customized Studio.',
      'Beyond the build system, v6 improves default search so editors find the right document faster, and it opens up custom authentication for teams with their own identity requirements. We’re also dropping support for end-of-life Node 20.',
      'None of these are flashy features on their own. Together they make the everyday experience of working in the Studio noticeably calmer and faster — which is exactly what a mature tool should do as it matures.',
    ],
  },
  {
    slug: 'context-board-game-agent',
    title: 'A board game agent built with Sanity Context and Vercel’s AI SDK',
    dek: 'An OpenAI Agent, a board game API, and Sanity Context walk into a bar. The result: a CLI that returns exact recs with real-time data.',
    authors: ['Jarod Reyes'],
    publishedAt: '2026-05-26',
    category: 'Guide',
    image: 'autumn-tundra.png',
    sourceUrl: 'https://www.sanity.io/blog/context-board-game-agent',
    body: [
      'An OpenAI Agent, a board game API, and Sanity Context walk into a bar. The result is a small CLI agent that returns exact game recommendations backed by real-time data instead of vibes.',
      'The trick is grounding. Left to its own knowledge, a model will happily recommend games that don’t match your player count, playtime, or complexity. By giving the agent structured queries against a real catalog, the recommendations become answers you can trust rather than guesses you have to double-check.',
      'Wiring it together with Vercel’s AI SDK is refreshingly little code. The agent describes what it needs, the tools fetch structured content, and the model composes a precise reply. It’s a tidy example of the broader pattern: structure in, reliable answers out.',
    ],
  },
  {
    slug: 'better-context-better-matches',
    title: 'Better context, better matches: an AI love story (for dogs)',
    dek: 'Search filters force users to think in database terms. What happens when you let structured content do the work instead?',
    authors: ['Ken Jones'],
    publishedAt: '2026-04-06',
    category: 'Content Strategy',
    image: 'pine-forest.png',
    sourceUrl: 'https://www.sanity.io/blog/better-context-better-matches-ai-love-story-for-dogs',
    body: [
      'Search filters force users to think in database terms. Breed, age, weight, distance — a wall of dropdowns that assumes you already know exactly what you want. Most people looking to adopt a dog don’t think that way. They think in feelings and situations.',
      'This AI-powered dog adoption app shows what happens when you let structured content do the work instead. A person can describe their apartment, their schedule, and their energy level in plain language, and the app matches them to dogs whose structured attributes actually fit.',
      'The magic isn’t the model — it’s the structure underneath it. Because each dog’s profile is modeled as clean, queryable content, the agent can translate a fuzzy human wish into precise matches. Better context, better matches.',
    ],
  },
  {
    slug: 'build-a-conference-concierge',
    title: 'Build a conference concierge with Agent Context and Anthropic',
    dek: 'Agent Context gives you MCP tools for your content. Wire them into streamText, and now you have a chatbot.',
    authors: ['Knut Melvær'],
    publishedAt: '2026-04-22',
    category: 'Guide',
    image: 'coast-archipelago.png',
    sourceUrl:
      'https://www.sanity.io/blog/build-a-conference-concierge-with-agent-context-and-anthropic',
    body: [
      'Agent Context gives you MCP tools for your content. Wire them into streamText with an Anthropic model, and you have a conference concierge that actually knows the schedule.',
      'The concierge can answer questions like which talks are on right now, what’s happening next in a given room, and which sessions match a visitor’s interests. Because it reads structured content rather than a static FAQ, it stays correct even when the schedule changes at the last minute.',
      'What makes this approach pleasant is how little glue code it needs. The tools expose your content, the model reasons over it, and the streaming response feels immediate. It’s a small build with a genuinely useful result.',
    ],
  },
]
