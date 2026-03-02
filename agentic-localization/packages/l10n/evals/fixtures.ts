import {markdownToPortableText} from '@portabletext/markdown'

import type {GlossaryEntry, Glossary, StyleGuide} from '../src/promptAssembly'
import {resolveLocaleDefaults} from '../src/utils'

/** markdownToPortableText returns the @portabletext/schema union type;
 *  cast to the TypeGen-derived block structure used by StyleGuide. */
function mdToBlocks(markdown: string): NonNullable<StyleGuide['additionalInstructions']> {
  return markdownToPortableText(markdown) as NonNullable<StyleGuide['additionalInstructions']>
}

// --- Locales ---

function locale(code: string) {
  const {title} = resolveLocaleDefaults(code)
  return {code, title}
}

export const enUS = locale('en-US')
export const deDE = locale('de-DE')
export const frFR = locale('fr-FR')
export const jaJP = locale('ja-JP')

// --- Glossary entries ---

/** Fill null defaults for unset entry fields (TypeGen requires all fields present). */
function entry(
  fields: Pick<GlossaryEntry, 'term' | 'status'> & Partial<GlossaryEntry>,
): GlossaryEntry {
  return {
    doNotTranslate: null,
    partOfSpeech: null,
    definition: null,
    context: null,
    translations: null,
    ...fields,
  }
}

export const datasetEntry: GlossaryEntry = entry({
  term: 'dataset',
  status: 'approved',
  partOfSpeech: 'noun',
  definition:
    'A named collection of documents within a Sanity project. Each dataset is an isolated content store.',
  context: 'Create a staging dataset to test content changes before promoting to production.',
  translations: [
    {locale: 'de-DE', translation: 'Datensatz', gender: 'masculine'},
    {locale: 'fr-FR', translation: 'jeu de données', gender: 'masculine'},
    {locale: 'ja-JP', translation: 'データセット', gender: null},
  ],
})

export const documentActionEntry: GlossaryEntry = entry({
  term: 'document action',
  status: 'approved',
  partOfSpeech: 'noun',
  definition:
    'A button in the Studio publish menu that performs an operation on a document (publish, unpublish, duplicate, delete)',
  context: 'Add a custom document action to trigger translation when content is published.',
  translations: [
    {locale: 'de-DE', translation: 'Dokumentaktion', gender: 'feminine'},
    {locale: 'fr-FR', translation: 'action de document', gender: 'feminine'},
    {locale: 'ja-JP', translation: 'ドキュメントアクション', gender: null},
  ],
})

export const fieldEntry: GlossaryEntry = entry({
  term: 'field',
  status: 'approved',
  partOfSpeech: 'noun',
  definition:
    'A named, typed input within a Sanity document schema. Fields define the structure of your content.',
  context: 'Add a slug field to generate URL-friendly identifiers from the title.',
  translations: [
    {locale: 'de-DE', translation: 'Feld', gender: 'neuter'},
    {locale: 'fr-FR', translation: 'champ', gender: 'masculine'},
    {locale: 'ja-JP', translation: 'フィールド', gender: null},
  ],
})

export const contentLakeEntry: GlossaryEntry = entry({
  term: 'Content Lake',
  status: 'approved',
  doNotTranslate: true,
  definition: "Sanity's real-time backend data store for structured content",
})

export const sanityEntry: GlossaryEntry = entry({
  term: 'Sanity',
  status: 'approved',
  doNotTranslate: true,
})

export const groqEntry: GlossaryEntry = entry({
  term: 'GROQ',
  status: 'approved',
  doNotTranslate: true,
  definition: "Sanity's open-source query language (Graph-Relational Object Queries)",
})

export const studioEntry: GlossaryEntry = entry({
  term: 'Studio',
  status: 'approved',
  doNotTranslate: true,
  definition: "Sanity's open-source content editing environment (Sanity Studio)",
  context: 'Configure your Studio with custom document views and plugins.',
})

export const portableTextEntry: GlossaryEntry = entry({
  term: 'Portable Text',
  status: 'approved',
  doNotTranslate: true,
  definition: "Sanity's structured rich text format, stored as JSON and renderable anywhere",
  context: 'Use Portable Text for rich text that works across web, mobile, and print.',
})

export const perspectivesEntry: GlossaryEntry = entry({
  term: 'Perspectives',
  status: 'approved',
  doNotTranslate: true,
  definition: 'Feature for viewing content in different states (draft, published, release)',
  context: 'Switch between Perspectives to preview how content looks before publishing.',
})

export const releasesEntry: GlossaryEntry = entry({
  term: 'Releases',
  status: 'approved',
  doNotTranslate: true,
  definition: 'Feature for staging and coordinating content updates as a group',
  context: 'Group related changes into a Release, then publish everything at once.',
})

export const agentActionsEntry: GlossaryEntry = entry({
  term: 'Agent Actions',
  status: 'approved',
  doNotTranslate: true,
  definition:
    'Sanity API for invoking AI-powered actions (translate, generate, transform) on content documents',
  context: 'Use Agent Actions to translate documents into any target locale.',
})

export const contentOperatingSystemEntry: GlossaryEntry = entry({
  term: 'Content Operating System',
  status: 'approved',
  doNotTranslate: true,
  definition:
    'The platform category Sanity defines for structured content management in the AI era',
  context: 'Sanity is the Content Operating System for teams building modern digital experiences.',
})

export const presentationToolEntry: GlossaryEntry = entry({
  term: 'Presentation Tool',
  status: 'approved',
  doNotTranslate: true,
  definition: 'Sanity Studio plugin for visual editing with live preview of front-end applications',
  context: 'Connect your Next.js app to the Presentation Tool for click-to-edit overlays.',
})

export const webpageForbiddenEntry: GlossaryEntry = entry({
  term: 'webpage',
  status: 'forbidden',
  definition: 'Use "page" instead. "Webpage" is outdated terminology.',
})

export const clickHereForbiddenEntry: GlossaryEntry = entry({
  term: 'click here',
  status: 'forbidden',
  definition: 'Use descriptive link text instead.',
})

export const cmsForbiddenEntry: GlossaryEntry = entry({
  term: 'CMS',
  status: 'forbidden',
  definition:
    'Do not describe Sanity as a CMS. Use "Content Operating System" or "structured content platform" instead.',
})

export const headlessCmsForbiddenEntry: GlossaryEntry = entry({
  term: 'headless CMS',
  status: 'forbidden',
  definition:
    'Avoid this category label for Sanity. Use "Content Operating System" or describe specific capabilities instead.',
})

// --- Glossary ---

export const techGlossary: Glossary = {
  title: 'Sanity Product Terminology',
  sourceLocale: enUS,
  entries: [
    datasetEntry,
    documentActionEntry,
    fieldEntry,
    contentLakeEntry,
    sanityEntry,
    groqEntry,
    studioEntry,
    portableTextEntry,
    perspectivesEntry,
    releasesEntry,
    agentActionsEntry,
    contentOperatingSystemEntry,
    presentationToolEntry,
    webpageForbiddenEntry,
    clickHereForbiddenEntry,
    cmsForbiddenEntry,
    headlessCmsForbiddenEntry,
  ],
}

// --- Style guides ---

export const deDEStyleGuide: StyleGuide = {
  title: 'German (Germany) Style Guide',
  locale: deDE,
  formality: 'formal',
  tone: ['professional', 'precise', 'approachable'],
  additionalInstructions: mdToBlocks(
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
  ),
}

export const frFRStyleGuide: StyleGuide = {
  title: 'French (France) Style Guide',
  locale: frFR,
  formality: 'formal',
  tone: ['professional', 'elegant', 'authoritative'],
  additionalInstructions: mdToBlocks(
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
  ),
}

export const jaJPStyleGuide: StyleGuide = {
  title: 'Japanese (Japan) Style Guide',
  locale: jaJP,
  formality: 'formal',
  tone: ['professional', 'respectful', 'clear'],
  additionalInstructions: mdToBlocks(
    'Target audience: Developers evaluating Sanity for content infrastructure, and content editors who will use Studio daily in Japan.\n\n' +
      'Use desu/masu (です/ます) form throughout. Keep Sanity product names in their original Latin script. Write technical terms in katakana when no established Japanese equivalent exists. Use full-width punctuation (。、) consistently.\n\n' +
      'Do:\n' +
      '- "Sanity Studioを設定します" (product name in Latin script, desu/masu form)\n' +
      '- "コンテンツをContent Lakeに保存します" (product name in Latin script)\n' +
      '- "データセット" for dataset, "フィールド" for field\n\n' +
      'Do not:\n' +
      '- "サニティ" (do not transliterate "Sanity" to katakana)\n' +
      '- "コンテントレイク" (do not transliterate "Content Lake")',
  ),
}

// --- Style guide lookup helper for tests/evals ---

export const styleGuides = [deDEStyleGuide, frFRStyleGuide, jaJPStyleGuide]

export function styleGuideForLocale(locale: string): StyleGuide | undefined {
  return styleGuides.find((sg) => sg.locale?.code === locale)
}

// --- Sample source texts for eval cases ---

export const sourceTexts = {
  productTitle: 'Sanity Studio: Real-time Structured Content Platform',
  productDescription:
    'Sanity Studio gives your team a real-time environment for managing structured content in the Content Lake. ' +
    'Author rich text with Portable Text, query any field or dataset with GROQ, and preview across draft and published states using Perspectives. ' +
    'Coordinate launches by grouping changes into Releases, and add custom document actions to automate your workflow.',
  uiString: 'You have {{count}} pending document actions across this dataset.',
  marketingHeadline: 'Build faster with Sanity. Your content, everywhere.',
}
