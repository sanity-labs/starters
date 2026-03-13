/**
 * Custom AI Assist field action for translating internationalized array fields.
 *
 * Detects `internationalizedArray*` fields (text, string, blockContent, object, etc.)
 * and offers per-locale "Translate to {locale}" actions using glossary + style guide
 * context via `useTranslate`.
 *
 * Strategy: pre-create the target language array entry with the source value copied in,
 * then point the translate agent at the entry's `value` field. This lets the agent
 * operate on a properly typed field — not the wrapper array — so it works for any
 * value type (plain strings, Portable Text, nested objects, etc.).
 *
 * Languages are fetched via documentStore.listenQuery for realtime updates
 * (e.g. when an editor adds a new locale, the action list updates immediately).
 *
 * Wired into `assist({ fieldActions: { useFieldActions } })` in sanity.config.ts.
 */

import {useMemo} from 'react'
import {DEFAULT_STUDIO_CLIENT_OPTIONS, useClient} from 'sanity'
import {
  defineAssistFieldAction,
  defineAssistFieldActionGroup,
  type AssistFieldActionNode,
  type AssistFieldActionProps,
} from '@sanity/assist'
import {TranslateIcon} from '@sanity/icons'
import {randomKey} from '@sanity/util/content'

import type {InternationalizedArrayItem} from 'sanity-plugin-internationalized-array'

import {useTranslate} from '../useTranslate'
import {useLocales, type Language} from '../translations/useLocales'

export function useTranslateFieldAction(
  props: AssistFieldActionProps,
): (AssistFieldActionNode | undefined)[] {
  const {actionType, schemaType, documentIdForAction, schemaId, getDocumentValue, path} = props

  const client = useClient(DEFAULT_STUDIO_CLIENT_OPTIONS)
  const {translate} = useTranslate()

  const isInternationalizedArray =
    actionType === 'field' && schemaType.name?.startsWith('internationalizedArray')

  const allLocales = useLocales()
  const languages: Language[] = isInternationalizedArray ? allLocales : []

  return useMemo(() => {
    if (!isInternationalizedArray || languages.length === 0) return []

    const doc = getDocumentValue() as Record<string, unknown> | undefined
    const fieldName = path.length > 0 ? (path[0] as string) : undefined
    if (!fieldName || !doc) return []

    const currentEntries = (doc[fieldName] ?? []) as InternationalizedArrayItem[]

    const filledLocales = new Set(
      currentEntries
        .filter((e) => e.value != null && e.value !== '')
        .map((e) => e.language),
    )

    const translateActions = languages
      .filter((lang) => !filledLocales.has(lang.id))
      .map((lang) =>
        defineAssistFieldAction({
          title: `Translate to ${lang.title}`,
          icon: TranslateIcon,
          onAction: async () => {
            const sourceDoc = getDocumentValue() as Record<string, unknown>

            const entries = (sourceDoc[fieldName] ?? []) as InternationalizedArrayItem[]
            const baseEntry = entries.find((e) => e.value != null && e.value !== '')
            if (!baseEntry?.value || !baseEntry._key) return
            const fromLanguage = baseEntry.language ?? 'en-US'

            // Ensure the draft exists before patching — the inspector may be
            // opened on a published document that has no draft yet.
            await client.createIfNotExists({
              ...sourceDoc,
              _id: documentIdForAction,
              _type: sourceDoc._type as string,
            })

            const itemType = `${schemaType.name}Value`
            const entryKey = randomKey(12)

            // Translate source value without writing (noWrite) to avoid a
            // replication-delay race where the Agent API can't see a
            // just-committed array entry.
            const translated = await translate(
              {
                schemaId,
                documentId: documentIdForAction,
                fromLanguage: {id: fromLanguage},
                toLanguage: {id: lang.id, title: lang.title},
                target: {path: [fieldName, {_key: baseEntry._key}, 'value']},
                noWrite: true,
              },
              sourceDoc,
            )

            // Extract translated value from the returned document.
            const translatedEntries = (
              (translated as Record<string, unknown> | null)?.[fieldName] ?? []
            ) as InternationalizedArrayItem[]
            const translatedEntry = translatedEntries.find((e) => e._key === baseEntry._key)
            if (!translatedEntry?.value) return

            // Write the target entry with the translated value.
            await client
              .patch(documentIdForAction)
              .setIfMissing({[fieldName]: []})
              .unset([`${fieldName}[language=="${lang.id}"]`])
              .append(fieldName, [
                {_key: entryKey, _type: itemType, language: lang.id, value: translatedEntry.value},
              ])
              .commit()
          },
        }),
      )

    if (translateActions.length === 0) return []

    return [
      defineAssistFieldActionGroup({
        title: 'Translate',
        icon: TranslateIcon,
        children: translateActions,
      }),
    ]
  }, [
    isInternationalizedArray,
    languages,
    getDocumentValue,
    path,
    translate,
    schemaId,
    schemaType.name,
    documentIdForAction,
    client,
  ])
}
