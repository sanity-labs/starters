import {scheduledEventHandler} from '@sanity/functions'
import {createClient} from '@sanity/client'

const ESP_IMPORT_ID = 'espImport'

export const handler = scheduledEventHandler(async ({context}) => {
  const startedAt = Date.now()
  const projectId = process.env.SANITY_STUDIO_PROJECT_ID
  const dataset = process.env.SANITY_STUDIO_DATASET
  const token = context.clientOptions?.token

  console.log(
    `[scheduled-import-resend-segments] Starting (project=${projectId ?? 'unknown'} dataset=${dataset ?? 'unknown'} local=${context.local ?? false})`,
  )

  if (!projectId || !dataset || !token) {
    console.error(
      `[scheduled-import-resend-segments] Missing client config: projectId=${Boolean(projectId)} dataset=${Boolean(dataset)} token=${Boolean(token)}. SANITY_STUDIO_PROJECT_ID and SANITY_STUDIO_DATASET must be set in the function env (via the blueprint), and the robotToken must resolve.`,
    )
    throw new Error('Missing Sanity client configuration')
  }

  try {
    const client = createClient({
      projectId,
      dataset,
      token,
      apiHost: context.clientOptions?.apiHost,
      apiVersion: '2026-04-08',
      useCdn: false,
    })

    console.log(`[scheduled-import-resend-segments] Reading current state of ${ESP_IMPORT_ID}`)
    const current = await client.getDocument<{importState?: string; lastImportedAt?: string}>(
      ESP_IMPORT_ID,
    )

    if (!current) {
      console.warn(
        `[scheduled-import-resend-segments] Skipped: ${ESP_IMPORT_ID} document not found — create it in the Studio first`,
      )
      return
    }

    console.log(
      `[scheduled-import-resend-segments] Current importState=${current.importState ?? 'unset'} lastImportedAt=${current.lastImportedAt ?? 'never'}`,
    )

    if (current.importState === 'importing') {
      console.log('[scheduled-import-resend-segments] Skipped: import already in progress')
      return
    }

    await client.patch(ESP_IMPORT_ID).set({importState: 'requested'}).commit()
    console.log(
      `[scheduled-import-resend-segments] Success: patched importState=requested in ${Date.now() - startedAt}ms — import-resend-segments function will now run`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.error(
      `[scheduled-import-resend-segments] Failed after ${Date.now() - startedAt}ms: ${message}`,
    )
    if (stack) console.error(stack)
    throw error
  }
})
