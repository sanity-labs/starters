// Scheduled function: runs on a cron schedule defined in sanity.blueprint.ts
// (currently midnight and noon Pacific time). It doesn't do the import work
// itself — it just flips a flag on the `klaviyoImport` document, which causes
// the sibling `import-klaviyo` document function to run. This split keeps each
// function small and easy to reason about.
import {scheduledEventHandler} from '@sanity/functions'
import {createClient} from '@sanity/client'
import {env} from 'node:process'

// The singleton document we toggle to trigger the real import.
const KLAVIYO_IMPORT_ID = 'klaviyoImport'

export const handler = scheduledEventHandler(async ({context}) => {
  const startedAt = Date.now()

  // Scheduled functions don't have a triggering document, so unlike a document
  // function `context.clientOptions` won't include projectId/dataset. The
  // blueprint reads them from .env at deploy time and passes them in via
  // `env: {...}` so we can read them from process.env here.
  const {SANITY_STUDIO_PROJECT_ID: projectId, SANITY_STUDIO_DATASET: dataset} = env

  // The token is the robot token declared in sanity.blueprint.ts. The platform
  // resolves it and attaches it to context.clientOptions for us.
  const token = context.clientOptions?.token

  console.log(
    `[scheduled-import-klaviyo] Starting (project=${projectId ?? 'unknown'} dataset=${dataset ?? 'unknown'} local=${context.local ?? false})`,
  )

  if (!projectId || !dataset || !token) {
    console.error(
      `[scheduled-import-klaviyo] Missing client config: projectId=${Boolean(projectId)} dataset=${Boolean(dataset)} token=${Boolean(token)}. SANITY_STUDIO_PROJECT_ID and SANITY_STUDIO_DATASET must be set in the function env (via the blueprint), and the robotToken must resolve.`,
    )
    throw new Error('Missing Sanity client configuration')
  }

  const client = createClient({
    projectId,
    dataset,
    token,
    apiVersion: '2026-04-08',
    useCdn: false,
    requestTagPrefix: 'fn.email-marketing.scheduled-import',
  })

  try {
    console.log(`[scheduled-import-klaviyo] Reading current state of ${KLAVIYO_IMPORT_ID}`)
    const current = await client.getDocument<{importState?: string; lastImportedAt?: string}>(
      KLAVIYO_IMPORT_ID,
      {tag: 'get-import-state'},
    )

    if (!current) {
      console.warn(
        `[scheduled-import-klaviyo] Skipped: ${KLAVIYO_IMPORT_ID} document not found — create it in the Studio first`,
      )
      return
    }

    console.log(
      `[scheduled-import-klaviyo] Current importState=${current.importState ?? 'unset'} lastImportedAt=${current.lastImportedAt ?? 'never'}`,
    )

    if (current.importState === 'importing') {
      console.log('[scheduled-import-klaviyo] Skipped: import already in progress')
      return
    }

    // Flipping importState to "requested" is the actual trigger. The
    // import-klaviyo document function has a blueprint filter that listens
    // for this exact transition, then does the real Klaviyo API work.
    await client
      .patch(KLAVIYO_IMPORT_ID)
      .set({importState: 'requested'})
      .commit({tag: 'request-import'})
    console.log(
      `[scheduled-import-klaviyo] Success: patched importState=requested in ${Date.now() - startedAt}ms — import-klaviyo function will now run`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.error(`[scheduled-import-klaviyo] Failed after ${Date.now() - startedAt}ms: ${message}`)
    if (stack) console.error(stack)
    throw error
  }
})
