import {defineEnableDraftMode} from 'next-sanity/draft-mode'

import {client} from '@/sanity/live'

/**
 * Where `previewUrl.previewMode.enable` in the Studio's `presentationTool`
 * lands. It validates the one-time secret Presentation appends, then turns
 * draft mode on and redirects to the requested page. The client needs a token:
 * the secret lives in a draft document.
 */
export const {GET} = defineEnableDraftMode({client})
