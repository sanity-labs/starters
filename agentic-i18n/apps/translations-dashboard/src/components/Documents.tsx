import {type DocumentHandle, useDocuments} from '@sanity/sdk-react'
import {Button, Card, Flex, Grid, Stack, Switch, Text} from '@sanity/ui'
import React, {Suspense, useEffect, useMemo, useRef} from 'react'

import {useApp} from '../contexts/AppContext'
import {TranslationStatusProvider} from '../contexts/TranslationStatusContext'
import {useBatchProcessState} from '../hooks/useBatchProcessState'
import {useDocumentFilter} from '../hooks/useDocumentFilter'
import {useTranslationConfig} from '../contexts/TranslationConfigContext'
import BatchTranslationPanel from './BatchTranslationPanel'
import DocumentDetail from './DocumentDetail'
import EmptyState from './DocumentDetail/EmptyState'
import PostPreviewItem, {DocumentPreviewItemSkeleton} from './DocumentPrevewItem'
import DocumentTypeSelector, {documentTypeLabels} from './DocumentTypeSelector'
import ErrorBoundary from './ErrorBoundary'
import Loading from './Loading'
import StatusSelector from './StatusSelector'

const Documents = () => {
  // Call ALL hooks first, before any conditional logic (Rules of Hooks)
  const {languages: configLanguages} = useTranslationConfig()
  const languagesLoaded = configLanguages.length > 0
  const {
    clearSelection,
    isBatchMode,
    languages,
    selectedDocuments,
    selectedDocumentType,
    selectedPost,
    setIsBatchMode,
    setSelectedPost,
    status,
    toggleDocumentSelection,
  } = useApp()

  // Memoize locale IDs and fallback map for the TranslationStatusProvider
  const localeIds = useMemo(() => languages.map((l) => l.id), [languages])
  const fallbackLocaleMap = useMemo(() => {
    const map = new Map<string, null | string>()
    for (const lang of languages) {
      map.set(lang.id, lang.fallbackLocale ?? null)
    }
    return map
  }, [languages])

  // Use the comprehensive batch process state
  const {shouldDisableBatchModeToggle, shouldDisableDocumentSelection} = useBatchProcessState()

  // Ref to preserve scroll position
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // State to track load more scroll restoration
  const scrollPositionToRestore = useRef<null | number>(null)
  const previousDataLength = useRef<number>(0)

  const filter = useDocumentFilter()

  const {data, hasMore, loadMore} = useDocuments({
    batchSize: 20,
    documentType: selectedDocumentType,
    filter,
    orderings: [{direction: 'desc', field: '_createdAt'}],
  })

  // Clear selections when document type changes
  // `isBatchMode` is intentionally excluded — including it would cause the effect to fire when
  // batch mode toggles, immediately turning it off. We only want this to react to document type changes.
  useEffect(() => {
    clearSelection()
    setSelectedPost(null)
    if (isBatchMode) {
      setIsBatchMode(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDocumentType, clearSelection, setSelectedPost, setIsBatchMode])

  // Watch for data changes to restore scroll position after load more
  useEffect(() => {
    const currentLength = data?.length || 0

    // If data length increased and we have a scroll position to restore
    if (currentLength > previousDataLength.current && scrollPositionToRestore.current !== null) {
      // Use double requestAnimationFrame to ensure DOM is fully updated
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current && scrollPositionToRestore.current !== null) {
            scrollContainerRef.current.scrollTop = scrollPositionToRestore.current
            scrollPositionToRestore.current = null // Clear after restoring
          }
        })
      })
    }

    previousDataLength.current = currentLength
  }, [data])

  // Handle load more with scroll preservation
  const handleLoadMore = () => {
    // Preserve scroll position before loading more
    const scrollTop = scrollContainerRef.current?.scrollTop

    if (scrollTop !== undefined) {
      scrollPositionToRestore.current = scrollTop
    }

    loadMore()
  }

  const handleBatchModeToggle = (enabled: boolean) => {
    // Prevent toggling during batch operations
    if (shouldDisableBatchModeToggle) {
      return
    }

    setIsBatchMode(enabled)
    if (!enabled) {
      clearSelection()
    }
    // Close document detail when entering batch mode
    if (enabled && selectedPost) {
      setSelectedPost(null)
    }
  }

  // Auto-disable batch mode when switching to statuses that don't support it
  React.useEffect(() => {
    if (isBatchMode && status === 'fully-translated') {
      setIsBatchMode(false)
      clearSelection()
    }
  }, [status, isBatchMode, setIsBatchMode, clearSelection])

  const handleDocumentClick = (document: DocumentHandle) => {
    if (isBatchMode) {
      // Prevent selection changes during batch operations
      if (shouldDisableDocumentSelection) {
        return
      }

      // Preserve scroll position before state change
      const scrollTop = scrollContainerRef.current?.scrollTop

      // In batch mode, toggle document selection
      toggleDocumentSelection(document.documentId)

      // Restore scroll position after state update
      if (scrollTop !== undefined) {
        // Use requestAnimationFrame to ensure the DOM has updated
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollTop
          }
        })
      }
      return
    }

    setSelectedPost(document)
  }

  // Don't render documents until languages are loaded (checked AFTER all hooks)
  if (!languagesLoaded) {
    return <Loading />
  }
  return (
    <TranslationStatusProvider fallbackLocaleMap={fallbackLocaleMap} localeIds={localeIds}>
      <Grid className="h-full" columns={6}>
        {/* Left side of the screen */}
        <Card className="relative" columnEnd={4} columnStart={1}>
          <Suspense fallback={<Loading />}>
            {/* Fixed header */}
            <div className="bg-white pt-4 px-4 pb-2 border-b border-gray-200  sticky top-0 z-10">
              <Stack space={3}>
                <DocumentTypeSelector />
                <StatusSelector />
                {(status === 'untranslated' ||
                  status === 'partially-translated' ||
                  status === 'all') && (
                  <Card padding={3} radius={2} tone="transparent">
                    <Flex align="center" gap={3} justify="space-between">
                      <Flex align="center" gap={3}>
                        <Text size={2} weight="medium">
                          Batch Mode
                        </Text>
                        <Switch
                          checked={isBatchMode}
                          disabled={shouldDisableBatchModeToggle}
                          onChange={(event) => handleBatchModeToggle(event.currentTarget.checked)}
                        />
                      </Flex>
                      {isBatchMode && selectedDocuments.length > 0 && (
                        <Flex align="center" gap={3}>
                          <Text muted size={1}>
                            {selectedDocuments.length} selected
                          </Text>
                          <Button
                            disabled={shouldDisableDocumentSelection}
                            mode="ghost"
                            onClick={clearSelection}
                            size={1}
                            text="Deselect All"
                            tone="default"
                          />
                        </Flex>
                      )}
                    </Flex>
                  </Card>
                )}
              </Stack>
            </div>

            {/* Scrollable document list */}
            <div ref={scrollContainerRef}>
              <div className="pt-2 px-4">
                <ul>
                  {data?.map((document) => {
                    const isDetailSelected = selectedPost?.documentId === document.documentId
                    const isBatchSelected =
                      isBatchMode && selectedDocuments.includes(document.documentId)
                    return (
                      <li
                        className={'border-b border-gray-200 dark:border-gray-200'}
                        key={document.documentId}
                      >
                        <button
                          className={`w-full text-left justify-start p-3 border-none outline-none transition-background duration-200
                      ${
                        isBatchMode && shouldDisableDocumentSelection
                          ? 'cursor-not-allowed opacity-60'
                          : 'cursor-pointer'
                      }
                      ${
                        isDetailSelected && !isBatchMode
                          ? 'bg-blue-50 dark:bg-blue-500/10 border-l-4 outline border-none '
                          : isBatchSelected
                            ? 'bg-blue-100 dark:bg-blue-600/20 border-l-4 border-blue-400'
                            : !shouldDisableDocumentSelection &&
                              'hover:bg-gray-55 hover:bg-blue-300/60'
                      }
                    `}
                          disabled={isBatchMode && shouldDisableDocumentSelection}
                          onClick={() => handleDocumentClick(document)}
                        >
                          <Suspense fallback={<DocumentPreviewItemSkeleton />}>
                            <PostPreviewItem {...document} />
                          </Suspense>
                        </button>
                      </li>
                    )
                  })}
                  {hasMore && (
                    <li className="flex py-3">
                      <Button
                        className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 my-4"
                        onClick={handleLoadMore}
                        text="Load more"
                      />
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </Suspense>
        </Card>
        {/* Right side of the screen */}
        <Card borderLeft className="relative" columnEnd={7} columnStart={4}>
          <ErrorBoundary featureName="Document Details">
            <Suspense fallback={<Loading />}>
              {!isBatchMode ? (
                <DocumentDetail selectedPost={selectedPost} />
              ) : selectedDocuments.length > 0 ? (
                <div className="h-full p-4">
                  <BatchTranslationPanel />
                </div>
              ) : (
                <div className="sticky top-0 h-screen flex items-center justify-center">
                  <EmptyState
                    isBatchMode
                    selectedDocumentType={documentTypeLabels[selectedDocumentType].slice(0, -1)}
                  />
                </div>
              )}
            </Suspense>
          </ErrorBoundary>
        </Card>
      </Grid>
    </TranslationStatusProvider>
  )
}

export default Documents
