import {describe, it, expect} from 'vitest'
import {
  buildGlossarySection,
  buildStyleGuideSection,
  assembleStyleGuide,
  extractDocumentText,
  filterGlossaryByContent,
  extractProtectedPhrases,
  measureStyleGuide,
  STYLE_GUIDE_WARN_THRESHOLD,
  buildTranslateParams,
} from './promptAssembly'
import {techGlossary, enUS, deDE, deDEStyleGuide, frFRStyleGuide} from '../evals/fixtures'

describe('buildGlossarySection', () => {
  it('includes approved terms with translations for the target locale', () => {
    const result = buildGlossarySection([techGlossary], 'fr-FR')
    expect(result).toContain('"dataset" → "jeu de données"')
    expect(result).toContain('"document action" → "action de document"')
  })

  it('includes part of speech and gender metadata', () => {
    const result = buildGlossarySection([techGlossary], 'fr-FR')
    expect(result).toContain('(noun, masculine)')
  })

  it('includes entry context when available', () => {
    const result = buildGlossarySection([techGlossary], 'fr-FR')
    expect(result).toContain('Context: Create a staging dataset')
  })

  it('excludes approved entries that have no translation for the target locale', () => {
    const result = buildGlossarySection([techGlossary], 'ko-KR')
    // No Korean translations exist, so no approved terms section
    expect(result).not.toContain('Approved Terms')
    // But DNT and forbidden entries should still appear
    expect(result).toContain('Sanity')
    expect(result).toContain('webpage')
  })

  it('lists all DNT entries regardless of target locale', () => {
    const result = buildGlossarySection([techGlossary], 'de-DE')
    expect(result).toContain('Do Not Translate')
    expect(result).toContain('Content Lake')
    expect(result).toContain('Sanity')
    expect(result).toContain('GROQ')
  })

  it('lists forbidden entries with definitions', () => {
    const result = buildGlossarySection([techGlossary], 'de-DE')
    expect(result).toContain('Forbidden Terms')
    expect(result).toContain('"webpage"')
    expect(result).toContain('Use "page" instead')
    expect(result).toContain('"click here"')
  })

  it('returns empty string for glossaries with no entries', () => {
    const empty = {title: 'Empty', sourceLocale: techGlossary.sourceLocale, entries: null}
    expect(buildGlossarySection([empty], 'de-DE')).toBe('')
  })

  it('returns empty string for empty glossary array', () => {
    expect(buildGlossarySection([], 'de-DE')).toBe('')
  })

  it('deduplicates terms across multiple glossaries', () => {
    const duplicate = {...techGlossary, title: 'Second Glossary'}
    const result = buildGlossarySection([techGlossary, duplicate], 'de-DE')
    // Each DNT term should appear exactly once
    const sanityMatches = result.match(/- Sanity\b/g)
    expect(sanityMatches).toHaveLength(1)
    const groqMatches = result.match(/- GROQ\b/g)
    expect(groqMatches).toHaveLength(1)
    // Each forbidden term should appear exactly once
    const webpageMatches = result.match(/"webpage"/g)
    expect(webpageMatches).toHaveLength(1)
  })
})

describe('buildStyleGuideSection', () => {
  it('includes locale name and formality', () => {
    const result = buildStyleGuideSection(deDEStyleGuide)
    expect(result).toContain('Style Guide (German (Germany))')
    expect(result).toContain('Formality: formal')
  })

  it('includes tone adjectives', () => {
    const result = buildStyleGuideSection(deDEStyleGuide)
    expect(result).toContain('professional, precise, approachable')
  })

  it('includes additional instructions with absorbed content', () => {
    const result = buildStyleGuideSection(deDEStyleGuide)
    expect(result).toContain('Developers building with Sanity')
    expect(result).toContain('Entwickler:innen')
    expect(result).toContain('Sie')
  })

  it('includes additional instructions', () => {
    const result = buildStyleGuideSection(deDEStyleGuide)
    expect(result).toContain('Address the reader with \u201CSie\u201D (formal)')
  })

  it('omits fields that are not set', () => {
    const minimal = {
      ...deDEStyleGuide,
      tone: null,
      additionalInstructions: null,
    }
    const result = buildStyleGuideSection(minimal)
    expect(result).toContain('Formality: formal')
    expect(result).not.toContain('Tone:')
  })

  it('omits additional instructions when array is empty', () => {
    const empty = {
      ...deDEStyleGuide,
      additionalInstructions: [],
    }
    const result = buildStyleGuideSection(empty)
    expect(result).toContain('Formality: formal')
    expect(result).not.toContain('Developers building with Sanity')
  })
})

describe('assembleStyleGuide', () => {
  it('produces terminology and style guide sections for a fully configured locale', () => {
    const result = assembleStyleGuide([techGlossary], 'de-DE', deDEStyleGuide)
    expect(result).toContain('## Terminology')
    expect(result).toContain('## Style Guide')
  })

  it('matches the correct style guide for the target locale', () => {
    const deResult = assembleStyleGuide([techGlossary], 'de-DE', deDEStyleGuide)
    expect(deResult).toContain('German (Germany)')
    expect(deResult).not.toContain('French (France)')

    const frResult = assembleStyleGuide([techGlossary], 'fr-FR', frFRStyleGuide)
    expect(frResult).toContain('French (France)')
    expect(frResult).not.toContain('German (Germany)')
  })

  it('filters glossary terms to the target locale', () => {
    const result = assembleStyleGuide([techGlossary], 'fr-FR', frFRStyleGuide)
    expect(result).toContain('jeu de données')
    expect(result).not.toContain('Datensatz')
  })

  it('returns empty string with no glossaries and no style guide', () => {
    expect(assembleStyleGuide([], 'de-DE')).toBe('')
  })

  it('handles a locale with no matching style guide gracefully', () => {
    const result = assembleStyleGuide([techGlossary], 'ko-KR')
    // Should still have terminology (DNT + forbidden) but no style guide section
    expect(result).toContain('## Terminology')
    expect(result).not.toContain('## Style Guide')
  })
})

describe('extractDocumentText', () => {
  it('extracts plain string values', () => {
    const doc = {_id: 'doc1', _type: 'product', title: 'Hello World'}
    expect(extractDocumentText(doc)).toContain('Hello World')
  })

  it('skips system fields', () => {
    const doc = {
      _id: 'abc',
      _type: 'product',
      _rev: 'rev1',
      _createdAt: '2024-01-01',
      title: 'Real',
    }
    const text = extractDocumentText(doc)
    expect(text).not.toContain('abc')
    expect(text).not.toContain('product')
    expect(text).not.toContain('rev1')
    expect(text).not.toContain('2024-01-01')
    expect(text).toContain('Real')
  })

  it('extracts text from Portable Text blocks', () => {
    const doc = {
      _id: 'doc1',
      _type: 'post',
      body: [
        {
          _type: 'block',
          _key: 'b1',
          children: [
            {_type: 'span', _key: 's1', text: 'Hello '},
            {_type: 'span', _key: 's2', text: 'world'},
          ],
        },
        {
          _type: 'block',
          _key: 'b2',
          children: [{_type: 'span', _key: 's3', text: 'Second paragraph'}],
        },
      ],
    }
    const text = extractDocumentText(doc)
    expect(text).toContain('Hello world')
    expect(text).toContain('Second paragraph')
  })

  it('extracts text from nested objects', () => {
    const doc = {
      _id: 'doc1',
      _type: 'page',
      hero: {
        _type: 'heroSection',
        heading: 'Welcome',
        subheading: 'to our site',
      },
    }
    const text = extractDocumentText(doc)
    expect(text).toContain('Welcome')
    expect(text).toContain('to our site')
  })

  it('extracts text from arrays of strings', () => {
    const doc = {_id: 'doc1', _type: 'product', tags: ['headless', 'cms', 'api']}
    const text = extractDocumentText(doc)
    expect(text).toContain('headless')
    expect(text).toContain('cms')
    expect(text).toContain('api')
  })

  it('handles mixed nested structures', () => {
    const doc = {
      _id: 'doc1',
      _type: 'product',
      title: 'Sanity Studio',
      description: 'Real-time analytics',
      features: [
        {_type: 'feature', _key: 'f1', label: 'Content Lake integration'},
        {_type: 'feature', _key: 'f2', label: 'GROQ powered'},
      ],
    }
    const text = extractDocumentText(doc)
    expect(text).toContain('Sanity Studio')
    expect(text).toContain('Real-time analytics')
    expect(text).toContain('Content Lake integration')
    expect(text).toContain('GROQ powered')
  })

  it('returns empty string for null/undefined', () => {
    expect(extractDocumentText(null)).toBe('')
    expect(extractDocumentText(undefined)).toBe('')
  })

  it('returns empty string for numbers and booleans', () => {
    expect(extractDocumentText(42)).toBe('')
    expect(extractDocumentText(true)).toBe('')
  })

  it('skips reference objects entirely', () => {
    const doc = {
      _id: 'doc1',
      _type: 'post',
      title: 'My Post',
      author: {_type: 'reference', _ref: 'author-123'},
    }
    const text = extractDocumentText(doc)
    expect(text).toContain('My Post')
    expect(text).not.toContain('author-123')
    expect(text).not.toContain('reference')
  })

  it('skips image objects', () => {
    const doc = {
      _id: 'doc1',
      _type: 'post',
      title: 'My Post',
      mainImage: {
        _type: 'image',
        asset: {_type: 'reference', _ref: 'image-abc-200x200-png'},
        alt: 'A photo',
      },
    }
    const text = extractDocumentText(doc)
    expect(text).toContain('My Post')
    expect(text).not.toContain('image-abc')
    expect(text).not.toContain('A photo')
  })

  it('skips slug objects', () => {
    const doc = {
      _id: 'doc1',
      _type: 'post',
      title: 'My Post',
      slug: {_type: 'slug', current: 'my-post'},
    }
    const text = extractDocumentText(doc)
    expect(text).toContain('My Post')
    expect(text).not.toContain('my-post')
  })

  it('extracts text from PT arrays with leading custom blocks', () => {
    const doc = {
      _id: 'doc1',
      _type: 'post',
      body: [
        {_type: 'image', _key: 'i1', asset: {_type: 'reference', _ref: 'image-abc'}},
        {
          _type: 'block',
          _key: 'b1',
          children: [{_type: 'span', _key: 's1', text: 'Text after image'}],
        },
      ],
    }
    const text = extractDocumentText(doc)
    expect(text).toContain('Text after image')
  })

  it('returns empty string for empty object', () => {
    expect(extractDocumentText({})).toBe('')
  })

  it('returns empty string for empty array', () => {
    expect(extractDocumentText([])).toBe('')
  })
})

describe('filterGlossaryByContent', () => {
  it('keeps entries whose terms appear in the document', () => {
    const doc = {_id: 'doc1', _type: 'product', title: 'Configure your dataset and add a field'}
    const result = filterGlossaryByContent([techGlossary], doc)
    const terms = result[0].entries!.map((e) => e.term)
    expect(terms).toContain('dataset')
    expect(terms).toContain('field')
  })

  it('excludes approved entries whose terms do not appear in the document', () => {
    const doc = {_id: 'doc1', _type: 'product', title: 'Getting started guide'}
    const result = filterGlossaryByContent([techGlossary], doc)
    const terms = result[0].entries!.map((e) => e.term)
    // dataset and document action should not appear (they're not in the text)
    expect(terms).not.toContain('dataset')
    expect(terms).not.toContain('document action')
  })

  it('always includes DNT entries regardless of content', () => {
    const doc = {_id: 'doc1', _type: 'product', title: 'Getting started guide'}
    const result = filterGlossaryByContent([techGlossary], doc)
    const terms = result[0].entries!.map((e) => e.term)
    expect(terms).toContain('Sanity')
    expect(terms).toContain('GROQ')
    expect(terms).toContain('Content Lake')
  })

  it('always includes forbidden entries regardless of content', () => {
    const doc = {_id: 'doc1', _type: 'product', title: 'Getting started guide'}
    const result = filterGlossaryByContent([techGlossary], doc)
    const terms = result[0].entries!.map((e) => e.term)
    expect(terms).toContain('webpage')
    expect(terms).toContain('click here')
  })

  it('does case-insensitive matching', () => {
    const doc = {_id: 'doc1', _type: 'product', title: 'Create a new Dataset for testing'}
    const result = filterGlossaryByContent([techGlossary], doc)
    const terms = result[0].entries!.map((e) => e.term)
    expect(terms).toContain('dataset')
  })

  it('works with Portable Text content', () => {
    const doc = {
      _id: 'doc1',
      _type: 'post',
      body: [
        {
          _type: 'block',
          _key: 'b1',
          children: [
            {_type: 'span', _key: 's1', text: 'Add a custom document action to your schema'},
          ],
        },
      ],
    }
    const result = filterGlossaryByContent([techGlossary], doc)
    const terms = result[0].entries!.map((e) => e.term)
    expect(terms).toContain('document action')
  })

  it('returns empty array for empty document', () => {
    const doc = {_id: 'doc1', _type: 'product'}
    const result = filterGlossaryByContent([techGlossary], doc)
    expect(result).toEqual([])
  })

  it('returns empty array for glossaries with no entries', () => {
    const empty = {title: 'Empty', sourceLocale: techGlossary.sourceLocale, entries: null}
    const doc = {_id: 'doc1', _type: 'product', title: 'Configure a dataset'}
    const result = filterGlossaryByContent([empty], doc)
    expect(result).toEqual([])
  })

  it('deduplicates entries across multiple glossaries', () => {
    const duplicate = {...techGlossary, title: 'Second Glossary'}
    const doc = {_id: 'doc1', _type: 'product', title: 'Configure your dataset'}
    const result = filterGlossaryByContent([techGlossary, duplicate], doc)
    // All relevant entries should be in the first glossary; the second should be empty/absent
    const allTerms = result.flatMap((g) => g.entries!.map((e) => e.term))
    const datasetCount = allTerms.filter((t) => t === 'dataset').length
    expect(datasetCount).toBe(1)
    const sanityCount = allTerms.filter((t) => t === 'Sanity').length
    expect(sanityCount).toBe(1)
  })
})

describe('extractProtectedPhrases', () => {
  it('returns DNT terms from glossaries', () => {
    const result = extractProtectedPhrases([techGlossary])
    expect(result).toContain('Content Lake')
    expect(result).toContain('Sanity')
    expect(result).toContain('GROQ')
  })

  it('excludes non-DNT entries', () => {
    const result = extractProtectedPhrases([techGlossary])
    expect(result).not.toContain('dataset')
    expect(result).not.toContain('document action')
    expect(result).not.toContain('webpage')
  })

  it('deduplicates terms across glossaries', () => {
    const duplicate = {...techGlossary, title: 'Second Glossary'}
    const result = extractProtectedPhrases([techGlossary, duplicate])
    const sanityCount = result.filter((t) => t === 'Sanity').length
    expect(sanityCount).toBe(1)
  })

  it('returns empty array for glossaries with no entries', () => {
    const empty = {title: 'Empty', sourceLocale: enUS, entries: null}
    expect(extractProtectedPhrases([empty])).toEqual([])
  })

  it('returns empty array for empty glossary array', () => {
    expect(extractProtectedPhrases([])).toEqual([])
  })
})

describe('measureStyleGuide', () => {
  it('measures character count correctly', () => {
    const result = measureStyleGuide('Hello world')
    expect(result.charCount).toBe(11)
  })

  it('estimates tokens as chars / 4 rounded up', () => {
    const result = measureStyleGuide('Hello world')
    expect(result.estimatedTokens).toBe(3)
  })

  it('reports under threshold for short strings', () => {
    const result = measureStyleGuide('short')
    expect(result.isOverThreshold).toBe(false)
  })

  it('reports over threshold for large strings', () => {
    const large = 'x'.repeat(STYLE_GUIDE_WARN_THRESHOLD + 1)
    const result = measureStyleGuide(large)
    expect(result.isOverThreshold).toBe(true)
  })

  it('handles empty string', () => {
    const result = measureStyleGuide('')
    expect(result.charCount).toBe(0)
    expect(result.estimatedTokens).toBe(0)
    expect(result.isOverThreshold).toBe(false)
  })
})

describe('buildTranslateParams', () => {
  const baseOptions = {
    schemaId: 'test-schema-id',
    documentId: 'doc-123',
    glossaries: [techGlossary],
    targetLocale: deDE,
  }

  it('maps targetLocale to toLanguage {id, title}', () => {
    const result = buildTranslateParams(baseOptions)
    expect(result.toLanguage).toEqual({id: 'de-DE', title: deDE.title})
  })

  it('maps sourceLocale to fromLanguage when provided', () => {
    const result = buildTranslateParams({...baseOptions, sourceLocale: enUS})
    expect(result.fromLanguage).toEqual({id: 'en-US', title: enUS.title})
  })

  it('omits fromLanguage when sourceLocale is not provided', () => {
    const result = buildTranslateParams(baseOptions)
    expect(result.fromLanguage).toBeUndefined()
  })

  it('populates protectedPhrases from DNT entries', () => {
    const result = buildTranslateParams(baseOptions)
    expect(result.protectedPhrases).toContain('Sanity')
    expect(result.protectedPhrases).toContain('Content Lake')
    expect(result.protectedPhrases).toContain('GROQ')
  })

  it('assembles styleGuide string with glossary and style guide', () => {
    const result = buildTranslateParams({...baseOptions, styleGuide: deDEStyleGuide})
    expect(result.styleGuide).toContain('## Terminology')
    expect(result.styleGuide).toContain('## Style Guide')
  })

  it('defaults operation to create', () => {
    const result = buildTranslateParams(baseOptions)
    expect(result.targetDocument?.operation).toBe('create')
  })

  it('uses provided operation', () => {
    const result = buildTranslateParams({...baseOptions, operation: 'edit'})
    expect(result.targetDocument?.operation).toBe('edit')
  })

  it('includes targetDocumentId in targetDocument when provided', () => {
    const result = buildTranslateParams({...baseOptions, targetDocumentId: 'target-456'})
    expect(result.targetDocument?._id).toBe('target-456')
  })

  it('omits _id from targetDocument when targetDocumentId not provided', () => {
    const result = buildTranslateParams(baseOptions)
    expect(result.targetDocument?._id).toBeUndefined()
  })

  it('includes languageFieldPath when provided', () => {
    const result = buildTranslateParams({...baseOptions, languageFieldPath: 'language'})
    expect(result.languageFieldPath).toBe('language')
  })

  it('omits languageFieldPath when not provided', () => {
    const result = buildTranslateParams(baseOptions)
    expect(result.languageFieldPath).toBeUndefined()
  })

  it('passes through schemaId and documentId', () => {
    const result = buildTranslateParams(baseOptions)
    expect(result.schemaId).toBe('test-schema-id')
    expect(result.documentId).toBe('doc-123')
  })
})
