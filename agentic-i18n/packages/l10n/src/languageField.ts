import {
  DEFAULT_STUDIO_CLIENT_OPTIONS,
  type DocumentDefinition,
  type SchemaTypeDefinition,
  defineField,
} from 'sanity'
import type {SanityClient} from '@sanity/client'
import {defineQuery} from 'groq'
import {languageFieldName, localeTypeName} from './types'

export const LOCALE_EXISTS_QUERY = defineQuery(
  `defined(*[_type == "${localeTypeName}" && code == $code][0])`,
)
import {getFlagFromCode} from './utils'
import {LanguageInput} from './components/LanguageInput'
import {workflowStatesField, staleAnalysisField} from './schemas/metadataFields'

function isDocumentDefinition(type: SchemaTypeDefinition): type is DocumentDefinition {
  return type.type === 'document' && 'fields' in type
}

export async function validateLocaleCode(
  value: string | undefined,
  client: SanityClient,
): Promise<true | string> {
  if (!value) return true
  const exists = await client.fetch<boolean>(LOCALE_EXISTS_QUERY, {code: value})
  return exists || `"${value}" is not a configured locale`
}

const languageField = defineField({
  name: languageFieldName,
  type: 'string',
  readOnly: ({value}) => !!value,
  components: {
    input: LanguageInput,
  },
  validation: (rule) =>
    rule.custom(async (value, context) => {
      const client = context.getClient(DEFAULT_STUDIO_CLIENT_OPTIONS)
      return validateLocaleCode(value, client)
    }),
})

const LANGUAGE_SELECT_KEY = '__language'

function patchPreview(type: DocumentDefinition): DocumentDefinition {
  const existing = type.preview ?? {}
  const select = {...(existing.select ?? {}), [LANGUAGE_SELECT_KEY]: languageFieldName}
  const originalPrepare = existing.prepare

  return {
    ...type,
    preview: {
      ...existing,
      select,
      prepare(value) {
        const lang = value[LANGUAGE_SELECT_KEY] as string | undefined
        const flag = lang ? getFlagFromCode(lang) : ''
        const localeLabel = flag ? `${flag} ${lang}` : lang

        if (originalPrepare) {
          const result = originalPrepare(value)
          return {
            ...result,
            subtitle: result.subtitle ? `${localeLabel} — ${result.subtitle}` : localeLabel,
          }
        }

        const existingSubtitle = value.subtitle as string | undefined
        return {
          title: value.title as string | undefined,
          subtitle: existingSubtitle ? `${localeLabel} — ${existingSubtitle}` : localeLabel,
          media: value.media,
        }
      },
    },
  }
}

export function injectLanguageField(
  schemaTypes: readonly string[],
): (prev: SchemaTypeDefinition[]) => SchemaTypeDefinition[] {
  return (prev) =>
    prev.map((type) => {
      if (!isDocumentDefinition(type)) return type

      if (type.name === 'translation.metadata') {
        return {
          ...type,
          fields: [...(type.fields ?? []), workflowStatesField, staleAnalysisField],
        }
      }

      if (schemaTypes.includes(type.name)) {
        return patchPreview({...type, fields: (type.fields ?? []).concat(languageField)})
      }

      return type
    })
}
