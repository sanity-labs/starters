/**
 * Custom AI Assist field action for translating internationalized array fields.
 *
 * Detects `internationalizedArray*` fields and offers per-locale "Translate to {locale}"
 * actions that use the starter's glossary + style guide infrastructure.
 *
 * Wired into `assist({ fieldActions: { useFieldActions } })` in sanity.config.ts.
 */

import {useEffect, useMemo, useState} from 'react'
import {DEFAULT_STUDIO_CLIENT_OPTIONS, useClient} from 'sanity'
import {
  defineAssistFieldAction,
  defineAssistFieldActionGroup,
  type AssistFieldActionNode,
  type AssistFieldActionProps,
} from '@sanity/assist'
import {TranslateIcon} from '@sanity/icons'

import {useTranslationContext} from '../translations/useTranslationContext'
import {SUPPORTED_LANGUAGES_QUERY} from '../queries'

type Language = {id: string; title: string}

const AGENT_API_VERSION = 'vX'

export function useTranslateFieldAction(
  props: AssistFieldActionProps,
): (AssistFieldActionNode | undefined)[] {
  const {actionType, schemaType, documentIdForAction, schemaId, getDocumentValue, path} = props

  const client = useClient(DEFAULT_STUDIO_CLIENT_OPTIONS)
  const agentClient = useClient({...DEFAULT_STUDIO_CLIENT_OPTIONS, apiVersion: AGENT_API_VERSION})
  const {getContextForLocale} = useTranslationContext()

  const isInternationalizedArray =
    actionType === 'field' && schemaType.name?.startsWith('internationalizedArray')

  const [languages, setLanguages] = useState<Language[]>([])

  useEffect(() => {
    if (!isInternationalizedArray) return
    client
      .fetch<Language[]>(SUPPORTED_LANGUAGES_QUERY)
      .then(setLanguages)
      .catch(() => {})
  }, [client, isInternationalizedArray])

  return useMemo(() => {
    if (!isInternationalizedArray || languages.length === 0) return []

    const doc = getDocumentValue()
    const fieldName = path.length > 0 ? path[0] : undefined
    const currentEntries = (
      fieldName ? (doc as Record<string, unknown>)[fieldName as string] : undefined
    ) as Array<{language?: string; value?: unknown}> | undefined

    const filledLocales = new Set(
      (currentEntries ?? [])
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
            const context = await getContextForLocale(lang.id, sourceDoc)

            const entries = (fieldName ? sourceDoc[fieldName as string] : undefined) as
              | Array<{language?: string; value?: unknown}>
              | undefined
            const baseEntry = entries?.find((e) => e.value != null && e.value !== '')
            const fromLanguage = baseEntry?.language ?? 'en-US'

            await agentClient.agent.action.translate({
              schemaId,
              documentId: documentIdForAction,
              fromLanguage: {id: fromLanguage},
              toLanguage: {id: lang.id, title: lang.title},
              target: {path},
              ...(context.styleGuide && {styleGuide: context.styleGuide}),
              ...(context.protectedPhrases.length > 0 && {
                protectedPhrases: context.protectedPhrases,
              }),
            })
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
    agentClient,
    schemaId,
    documentIdForAction,
    getContextForLocale,
  ])
}
