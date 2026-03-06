import {DocumentId} from '@sanity/id-utils'
import {useAgentTranslate, useClient, useCurrentUser} from '@sanity/sdk-react'
import {useCallback, useEffect, useRef, useState} from 'react'

import {MAX_CONCURRENT_TRANSLATIONS} from '../consts/translation'
import {useTranslationConfig} from '../contexts/TranslationConfigContext'
import {useTranslationStatusContext} from '../contexts/TranslationStatusContext'
import {isAbortError} from '../lib/awaitAgentResult'
import {fetchOrCreateMetadata} from '../lib/metadataOperations'
import {executeTranslation} from '../lib/translationExecutor'
import {useTranslationParams} from './useTranslationParams'

type Locale = {
  fallbackLocale?: null | string
  flag?: string
  id: string
  releaseId?: string
  title: string
}

type TranslationState = {
  error?: string
  languageId: string
  languageTitle: string
  progress?: number
  releaseName?: string
  status: 'completed' | 'completing' | 'failed' | 'missing' | 'translating'
  translatedDocumentId?: string
  translatedDocumentTitle?: null | string
}

type UseSelectiveTranslationReturn = {
  isTranslating: boolean
  retryFailedLanguage: (languageId: string) => Promise<void>
  translateAllLanguages: () => Promise<void>
  translateSingleLanguage: (languageId: string) => Promise<void>
  translationStates: Record<string, TranslationState>
}

export const useSelectiveTranslation = (
  baseDocumentId: DocumentId | undefined,
  baseLanguage: null | string | undefined,
  availableLanguages: Locale[],
  existingTranslations: Array<{_id: string; language: null | string; title: null | string}>,
  documentType: string,
  selectedRelease: null | string,
  metadataId?: string,
): UseSelectiveTranslationReturn => {
  const {sanityClientConfig, translationsConfig} = useTranslationConfig()
  const client = useClient(sanityClientConfig)
  const currentUser = useCurrentUser()
  const {updateLocaleStatus} = useTranslationStatusContext()
  const translate = useAgentTranslate()
  const {buildParams} = useTranslationParams()

  const initializeStates = useCallback((): Record<string, TranslationState> => {
    const states: Record<string, TranslationState> = {}
    availableLanguages.forEach((lang) => {
      if (!lang || !lang.id || lang.id === baseLanguage) return
      const existing = existingTranslations?.find((t) => t && t.language && t.language === lang.id)
      states[lang.id] = {
        languageId: lang.id,
        languageTitle: lang.title || lang.id,
        status: existing ? 'completed' : 'missing',
        translatedDocumentId: existing?._id,
        translatedDocumentTitle: existing?.title,
      }
    })
    return states
  }, [availableLanguages, baseLanguage, existingTranslations])

  const [translationStates, setTranslationStates] =
    useState<Record<string, TranslationState>>(initializeStates)
  const [inProgress, setInProgress] = useState<string[]>([])
  const [queued, setQueued] = useState<string[]>([])
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const abortRef = useRef<AbortController | null>(null)

  // Sync states when dependencies change, preserving active translations
  useEffect(() => {
    setTranslationStates((prev) => {
      const newStates = initializeStates()
      Object.keys(prev).forEach((langId) => {
        const prevState = prev[langId]
        const newState = newStates[langId]
        if (prevState.status === 'translating' || prevState.status === 'completing') {
          newStates[langId] = prevState
        } else if (
          prevState.status === 'completed' &&
          prevState.translatedDocumentId &&
          newState.status === 'missing'
        ) {
          newStates[langId] = prevState
        }
      })
      return newStates
    })
  }, [initializeStates])

  // Cleanup on unmount
  useEffect(() => {
    const timeouts = timeoutsRef.current
    return () => {
      abortRef.current?.abort()
      timeouts.forEach((t, key) => {
        if (key.includes('-progress-interval')) clearInterval(t)
        else clearTimeout(t)
      })
      timeouts.clear()
    }
  }, [])

  const processTranslation = useCallback(
    async (languageId: string): Promise<void> => {
      const controller = new AbortController()
      abortRef.current = controller

      if (!baseDocumentId || !baseLanguage) {
        throw new Error('Base document ID and base language are required')
      }

      const language = availableLanguages.find((lang) => lang && lang.id === languageId)
      if (!language || !language.id) {
        throw new Error(`Language ${languageId} not found or invalid`)
      }

      try {
        setTranslationStates((prev) => ({
          ...prev,
          [languageId]: {...prev[languageId], progress: 0, status: 'translating'},
        }))

        // Fake progressive loading: 0% -> 70% over ~30s
        const progressInterval = setInterval(() => {
          setTranslationStates((prev) => ({
            ...prev,
            [languageId]: {
              ...prev[languageId],
              progress: Math.min((prev[languageId]?.progress || 0) + 2, 70),
            },
          }))
        }, 850)
        timeoutsRef.current.set(
          `${languageId}-progress-interval`,
          progressInterval as unknown as NodeJS.Timeout,
        )

        const metadataDoc = await fetchOrCreateMetadata(
          client,
          baseDocumentId,
          baseLanguage,
          documentType,
        )
        if (!metadataDoc.translations) metadataDoc.translations = []

        const result = await executeTranslation({
          baseDocumentId,
          baseLanguage,
          buildParams,
          client,
          currentUserId: currentUser?.id,
          documentType,
          language,
          languageField: translationsConfig.languageField,
          metadataDoc,
          metadataId,
          selectedRelease,
          signal: controller.signal,
          translate: translate as unknown as Parameters<typeof executeTranslation>[0]['translate'],
          updateLocaleStatus,
        })

        // Clear progress interval
        const interval = timeoutsRef.current.get(`${languageId}-progress-interval`)
        if (interval) {
          clearInterval(interval)
          timeoutsRef.current.delete(`${languageId}-progress-interval`)
        }

        if (result) {
          setTranslationStates((prev) => ({
            ...prev,
            [languageId]: {
              ...prev[languageId],
              progress: 100,
              releaseName: result.releaseName,
              status: 'translating',
              translatedDocumentId: result.documentId,
              translatedDocumentTitle: result.documentTitle,
            },
          }))

          // Animate: completing -> completed
          const transitionId = setTimeout(() => {
            setTranslationStates((prev) => ({
              ...prev,
              [languageId]: {...prev[languageId], status: 'completing'},
            }))
            const completionId = setTimeout(() => {
              setTranslationStates((prev) => ({
                ...prev,
                [languageId]: {...prev[languageId], status: 'completed'},
              }))
              timeoutsRef.current.delete(`${languageId}-transition`)
              timeoutsRef.current.delete(`${languageId}-completion`)
            }, 2500)
            timeoutsRef.current.set(`${languageId}-completion`, completionId)
          }, 500)
          timeoutsRef.current.set(`${languageId}-transition`, transitionId)
        }
      } catch (error) {
        const interval = timeoutsRef.current.get(`${languageId}-progress-interval`)
        if (interval) {
          clearInterval(interval)
          timeoutsRef.current.delete(`${languageId}-progress-interval`)
        }
        if (isAbortError(error)) return

        let userMessage = `Failed to create translation for ${language.title}`
        if (error instanceof Error) {
          if (error.message.includes('Too Many Requests') || error.message.includes('rate limit')) {
            userMessage = 'Rate limit reached. Please wait a few minutes and retry.'
          } else if (error.message.includes('network') || error.message.includes('connection')) {
            userMessage = 'Network error. Please check your connection and retry.'
          } else if (error.message.includes('timeout')) {
            userMessage = 'Request timed out. Please retry.'
          } else {
            userMessage = `${userMessage}: ${error.message}`
          }
        }

        setTranslationStates((prev) => ({
          ...prev,
          [languageId]: {...prev[languageId], error: userMessage, status: 'failed'},
        }))
        throw error
      }
    },
    [
      baseDocumentId,
      baseLanguage,
      availableLanguages,
      buildParams,
      client,
      documentType,
      selectedRelease,
      currentUser,
      metadataId,
      translate,
      updateLocaleStatus,
      translationsConfig.languageField,
    ],
  )

  const processQueue = useCallback(async () => {
    setQueued((currentQueued) => {
      setInProgress((currentInProgress) => {
        const slotsAvailable = MAX_CONCURRENT_TRANSLATIONS - currentInProgress.length
        if (slotsAvailable <= 0 || currentQueued.length === 0) return currentInProgress
        const toStart = currentQueued.slice(0, slotsAvailable)
        const remainingQueue = currentQueued.slice(slotsAvailable)
        toStart.forEach((id) => {
          processTranslation(id)
            .catch((e) => console.error(`Translation failed for ${id}:`, e))
            .finally(() => {
              setInProgress((prev) => prev.filter((x) => x !== id))
              processQueue()
            })
        })
        setQueued(remainingQueue)
        return [...currentInProgress, ...toStart]
      })
      return currentQueued
    })
  }, [processTranslation])

  const translateSingleLanguage = useCallback(
    async (languageId: string): Promise<void> => {
      if (inProgress.includes(languageId) || queued.includes(languageId)) return
      if (inProgress.length < MAX_CONCURRENT_TRANSLATIONS) {
        setInProgress((prev) => [...prev, languageId])
        processTranslation(languageId)
          .catch((e) => console.error(`Translation failed for ${languageId}:`, e))
          .finally(() => {
            setInProgress((prev) => prev.filter((id) => id !== languageId))
            processQueue()
          })
      } else {
        setQueued((prev) => [...prev, languageId])
      }
    },
    [inProgress, queued, processTranslation, processQueue],
  )

  const translateAllLanguages = useCallback(async (): Promise<void> => {
    Object.values(translationStates)
      .filter((s) => s.status === 'missing')
      .forEach((s) => translateSingleLanguage(s.languageId))
  }, [translationStates, translateSingleLanguage])

  const retryFailedLanguage = useCallback(
    async (languageId: string): Promise<void> => {
      setTranslationStates((prev) => ({
        ...prev,
        [languageId]: {...prev[languageId], error: undefined, status: 'missing'},
      }))
      await translateSingleLanguage(languageId)
    },
    [translateSingleLanguage],
  )

  return {
    isTranslating: inProgress.length > 0 || queued.length > 0,
    retryFailedLanguage,
    translateAllLanguages,
    translateSingleLanguage,
    translationStates,
  }
}
