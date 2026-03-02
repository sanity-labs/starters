import {type DocumentHandle, useDocumentProjection} from '@sanity/sdk-react'
import {Text} from '@sanity/ui'
import {Suspense, useRef} from 'react'

import OpenInStudioButton from '../OpenInStudioButton'

export function TranslationDocumentWrapper({doc}: {doc: DocumentHandle}) {
  return (
    <Suspense
      fallback={
        <Text size={1} weight="semibold">
          Loading...
        </Text>
      }
    >
      <TranslationDocument doc={doc} />
    </Suspense>
  )
}

function TranslationDocument({doc}: {doc: DocumentHandle}) {
  const ref = useRef(null)
  const {data} = useDocumentProjection<{title?: string}>({
    ...doc,
    projection: '{title}',
    ref,
  })

  const title = typeof data?.title === 'string' ? data.title : 'Untitled'

  return (
    <Text ref={ref} size={1} weight="semibold">
      <OpenInStudioButton doc={doc} text title={title} />
    </Text>
  )
}
