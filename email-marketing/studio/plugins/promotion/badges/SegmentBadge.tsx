import {useEffect, useState} from 'react'
import {DEFAULT_STUDIO_CLIENT_OPTIONS, useClient, type DocumentBadgeComponent} from 'sanity'
import {defineQuery} from 'groq'

const SEGMENT_NAME_QUERY = defineQuery(`*[_type == "segment" && _id == $id][0].name`)

export const SegmentBadge: DocumentBadgeComponent = (props) => {
  const client = useClient(DEFAULT_STUDIO_CLIENT_OPTIONS)
  const [segmentName, setSegmentName] = useState<string | null>(null)

  const doc = props.draft ?? props.published
  const segmentRef = doc?.segment

  useEffect(() => {
    if (!segmentRef || typeof segmentRef !== 'object' || !('_ref' in segmentRef)) return
    let cancelled = false

    client
      .fetch<string | null>(
        SEGMENT_NAME_QUERY,
        {id: segmentRef._ref},
        {tag: 'promotion.badge.segment'},
      )
      .then((name) => {
        if (!cancelled && name) setSegmentName(name)
      })

    return () => {
      cancelled = true
    }
  }, [client, segmentRef])

  if (!segmentName) return null

  return {
    label: segmentName,
    color: 'default',
    title: `Targeting segment: ${segmentName}`,
  }
}
