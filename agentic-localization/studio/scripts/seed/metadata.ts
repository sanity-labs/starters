/**
 * Static translation metadata — glossary and style guides.
 *
 * These are sample documents using Sanity product terminology.
 * Replace with your own terminology and style guides for production use.
 */

import {markdownToPortableText} from '@portabletext/markdown'
import {ref} from './helpers.ts'

function localeRef(code: string) {
  return ref(`locale-${code}`)
}

function translation(locale: string, text: string, gender?: string) {
  return {
    _type: 'l10n.glossary.entry.translation',
    locale: localeRef(locale),
    translation: text,
    ...(gender && {gender}),
  }
}

// ─── Glossary entries ───────────────────────────────────────────────────────

const dntEntries = [
  {
    _type: 'l10n.glossary.entry',
    term: 'Sanity',
    status: 'approved',
    doNotTranslate: true,
    partOfSpeech: 'noun',
    definition:
      'The Content Operating System for structured content, real-time collaboration, and composable APIs',
    context: 'Sanity stores structured content that your front end queries via API.',
  },
  {
    _type: 'l10n.glossary.entry',
    term: 'Content Lake',
    status: 'approved',
    doNotTranslate: true,
    partOfSpeech: 'noun',
    definition: "Sanity's real-time backend data store for structured content",
    context: 'Store and query all your content in the Content Lake.',
  },
  {
    _type: 'l10n.glossary.entry',
    term: 'GROQ',
    status: 'approved',
    doNotTranslate: true,
    partOfSpeech: 'abbreviation',
    definition: "Sanity's open-source query language (Graph-Relational Object Queries)",
    context: 'Use GROQ to filter and project your content exactly how your frontend needs it.',
  },
  {
    _type: 'l10n.glossary.entry',
    term: 'Studio',
    status: 'approved',
    doNotTranslate: true,
    partOfSpeech: 'noun',
    definition: "Sanity's open-source content editing environment (Sanity Studio)",
    context: 'Configure your Studio with custom document views and plugins.',
  },
  {
    _type: 'l10n.glossary.entry',
    term: 'Portable Text',
    status: 'approved',
    doNotTranslate: true,
    partOfSpeech: 'noun',
    definition: "Sanity's structured rich text format, stored as JSON and renderable anywhere",
    context: 'Use Portable Text for rich text that works across web, mobile, and print.',
  },
  {
    _type: 'l10n.glossary.entry',
    term: 'Perspectives',
    status: 'approved',
    doNotTranslate: true,
    partOfSpeech: 'noun',
    definition: 'Feature for viewing content in different states (draft, published, release)',
    context: 'Switch between Perspectives to preview how content looks before publishing.',
  },
  {
    _type: 'l10n.glossary.entry',
    term: 'Releases',
    status: 'approved',
    doNotTranslate: true,
    partOfSpeech: 'noun',
    definition: 'Feature for staging and coordinating content updates as a group',
    context: 'Group related changes into a Release, then publish everything at once.',
  },
  {
    _type: 'l10n.glossary.entry',
    term: 'Agent Actions',
    status: 'approved',
    doNotTranslate: true,
    partOfSpeech: 'noun',
    definition:
      'Sanity API for invoking AI-powered actions (translate, generate, transform) on content documents',
    context: 'Use Agent Actions to translate documents into any target locale.',
  },
  {
    _type: 'l10n.glossary.entry',
    term: 'Content Operating System',
    status: 'approved',
    doNotTranslate: true,
    partOfSpeech: 'noun',
    definition:
      'The platform category Sanity defines for structured content management in the AI era',
    context:
      'Sanity is the Content Operating System for teams building modern digital experiences.',
  },
  {
    _type: 'l10n.glossary.entry',
    term: 'Presentation Tool',
    status: 'approved',
    doNotTranslate: true,
    partOfSpeech: 'noun',
    definition:
      'Sanity Studio plugin for visual editing with live preview of front-end applications',
    context: 'Connect your Next.js app to the Presentation Tool for click-to-edit overlays.',
  },
]

const approvedEntries = [
  {
    _type: 'l10n.glossary.entry',
    term: 'dataset',
    status: 'approved',
    partOfSpeech: 'noun',
    definition:
      'A named collection of documents within a Sanity project. Each dataset is an isolated content store.',
    context: 'Create a staging dataset to test content changes before promoting to production.',
    translations: [
      translation('de-DE', 'Datensatz', 'masculine'),
      translation('fr-FR', 'jeu de données', 'masculine'),
      translation('ja-JP', 'データセット'),
    ],
  },
  {
    _type: 'l10n.glossary.entry',
    term: 'document action',
    status: 'approved',
    partOfSpeech: 'noun',
    definition:
      'A button in the Studio publish menu that performs an operation on a document (publish, unpublish, duplicate, delete)',
    context: 'Add a custom document action to trigger translation when content is published.',
    translations: [
      translation('de-DE', 'Dokumentaktion', 'feminine'),
      translation('fr-FR', 'action de document', 'feminine'),
      translation('ja-JP', 'ドキュメントアクション'),
    ],
  },
  {
    _type: 'l10n.glossary.entry',
    term: 'field',
    status: 'approved',
    partOfSpeech: 'noun',
    definition:
      'A named, typed input within a Sanity document schema. Fields define the structure of your content.',
    context: 'Add a slug field to generate URL-friendly identifiers from the title.',
    translations: [
      translation('de-DE', 'Feld', 'neuter'),
      translation('fr-FR', 'champ', 'masculine'),
      translation('ja-JP', 'フィールド'),
    ],
  },
]

const forbiddenEntries = [
  {
    _type: 'l10n.glossary.entry',
    term: 'webpage',
    status: 'forbidden',
    partOfSpeech: 'noun',
    definition: 'Use "page" instead. "Webpage" is outdated terminology.',
  },
  {
    _type: 'l10n.glossary.entry',
    term: 'click here',
    status: 'forbidden',
    partOfSpeech: 'phrase',
    definition: 'Use descriptive link text instead.',
  },
  {
    _type: 'l10n.glossary.entry',
    term: 'CMS',
    status: 'forbidden',
    partOfSpeech: 'abbreviation',
    definition:
      'Do not describe Sanity as a CMS. Use "Content Operating System" or "structured content platform" instead.',
  },
  {
    _type: 'l10n.glossary.entry',
    term: 'headless CMS',
    status: 'forbidden',
    partOfSpeech: 'noun',
    definition:
      'Avoid this category label for Sanity. Use "Content Operating System" or describe specific capabilities instead.',
  },
]

// ─── Documents ──────────────────────────────────────────────────────────────

export const glossaryDocument = {
  _id: 'glossary-sanity-product-terminology',
  _type: 'l10n.glossary',
  title: 'Sanity Product Terminology',
  sourceLocale: localeRef('en-US'),
  entries: [...dntEntries, ...approvedEntries, ...forbiddenEntries],
}

const STYLE_GUIDES = [
  {
    code: 'de-DE',
    title: 'German (Germany) Style Guide',
    formality: 'formal',
    tone: ['professional', 'precise', 'approachable'],
    additionalInstructions:
      'Target audience: Developers building with Sanity, content editors managing structured content, and technical leaders evaluating content infrastructure in Germany, Austria, and Switzerland.\n\n' +
      'Gender guidance: Use gender-inclusive language. Prefer the gender colon form ("Entwickler:innen", "Redakteur:innen") for inclusive references to people.\n\n' +
      'Address the reader with "Sie" (formal). Avoid unnecessary anglicisms when established German terms exist, but keep Sanity product names in English.\n\n' +
      'Do:\n' +
      '- "Konfigurieren Sie Ihr Studio" (formal address)\n' +
      '- "Inhalte im Content Lake speichern" (keep product name in English)\n' +
      '- "Datensatz" for dataset, "Feld" for field\n\n' +
      'Do not:\n' +
      '- "Konfiguriere dein Studio" (too informal)\n' +
      '- "Inhalte im Inhaltssee speichern" (do not translate product names)',
  },
  {
    code: 'fr-FR',
    title: 'French (France) Style Guide',
    formality: 'formal',
    tone: ['professional', 'elegant', 'authoritative'],
    additionalInstructions:
      'Target audience: Developers integrating Sanity into front-end applications, and content teams managing editorial workflows in France.\n\n' +
      'Follow Académie française recommendations for French equivalents of English tech terms where established alternatives exist. Keep Sanity product names (Studio, Content Lake, GROQ, Portable Text) in English.\n\n' +
      'Use "vous" (formal). Write in active voice.\n\n' +
      'Do:\n' +
      '- "Interrogez vos contenus avec GROQ" (keep product name, use vous)\n' +
      '- "le jeu de données de production" (use French term for dataset)\n' +
      '- "action de document" for document action, "champ" for field\n\n' +
      'Do not:\n' +
      '- "Querier vos contenus" (franglais verb)\n' +
      '- "le Content Lake de Sanity" without first introducing the term in context',
  },
  {
    code: 'ja-JP',
    title: 'Japanese (Japan) Style Guide',
    formality: 'formal',
    tone: ['professional', 'respectful', 'clear'],
    additionalInstructions:
      'Target audience: Developers evaluating Sanity for content infrastructure, and content editors who will use Studio daily in Japan.\n\n' +
      'Use desu/masu (です/ます) form throughout. Keep Sanity product names in their original Latin script. Write technical terms in katakana when no established Japanese equivalent exists. Use full-width punctuation (。、) consistently.\n\n' +
      'Do:\n' +
      '- "Sanity Studioを設定します" (product name in Latin script, desu/masu form)\n' +
      '- "コンテンツをContent Lakeに保存します" (product name in Latin script)\n' +
      '- "データセット" for dataset, "フィールド" for field\n\n' +
      'Do not:\n' +
      '- "サニティ" (do not transliterate "Sanity" to katakana)\n' +
      '- "コンテントレイク" (do not transliterate "Content Lake")',
  },
]

export const styleGuideDocuments = STYLE_GUIDES.map((sg) => ({
  _id: `style-guide-${sg.code}`,
  _type: 'l10n.styleGuide',
  title: sg.title,
  locale: localeRef(sg.code),
  formality: sg.formality,
  tone: sg.tone,
  additionalInstructions: markdownToPortableText(sg.additionalInstructions),
}))
