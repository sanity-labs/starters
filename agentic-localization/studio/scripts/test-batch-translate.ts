/**
 * Verify: fieldLanguageMap + noWrite response shape from the translate API.
 *
 * Creates a person doc with two internationalized array fields (bio + seo.metaTitle),
 * then calls the translate API with fieldLanguageMap + noWrite: true. Logs the full
 * response to verify where translated values appear (input vs output paths).
 *
 * Usage:
 *   NODE_OPTIONS='--import tsx/esm' sanity exec scripts/test-batch-translate.ts --with-user-token
 */

import {randomBytes} from 'node:crypto'
import {getCliClient} from 'sanity/cli'

function randomKey(length: number): string {
  return randomBytes(length).toString('hex').slice(0, length)
}

const AGENT_API_VERSION = 'vX'
const TEST_DOC_ID = 'test-batch-translate'

const client = getCliClient().withConfig({apiVersion: AGENT_API_VERSION})

async function setup() {
  const bioKey = randomKey(12)
  const metaTitleKey = randomKey(12)

  await client.createOrReplace({
    _id: TEST_DOC_ID,
    _type: 'person',
    name: 'Batch Translate Test',
    bio: [
      {
        _key: bioKey,
        _type: 'internationalizedArrayTextValue',
        language: 'en-US',
        value: 'A researcher studying marine ecosystems in the Pacific Ocean.',
      },
    ],
    seo: {
      _type: 'seo',
      metaTitle: [
        {
          _key: metaTitleKey,
          _type: 'internationalizedArrayStringValue',
          language: 'en-US',
          value: 'Marine Ecosystem Researcher',
        },
      ],
    },
  })

  // Ensure published version exists
  const draft = await client.getDocument(`drafts.${TEST_DOC_ID}`)
  const published = await client.getDocument(TEST_DOC_ID)
  if (draft && !published) {
    const {_id, ...rest} = draft
    await client.createOrReplace({...rest, _id: TEST_DOC_ID})
  }

  return {bioKey, metaTitleKey}
}

async function testBatchTranslate(bioKey: string, metaTitleKey: string) {
  const params = {
    schemaId: '_.schemas.default',
    documentId: TEST_DOC_ID,
    toLanguage: {id: 'de-DE', title: 'German (Germany)'},
    noWrite: true,
    conditionalPaths: {defaultHidden: false},
    fieldLanguageMap: [
      {
        inputLanguageId: 'en-US',
        inputPath: `bio[_key=="${bioKey}"].value`,
        outputs: [{id: 'de-DE', outputPath: `bio[_key=="${bioKey}"].value`}],
      },
      {
        inputLanguageId: 'en-US',
        inputPath: `seo.metaTitle[_key=="${metaTitleKey}"].value`,
        outputs: [{id: 'de-DE', outputPath: `seo.metaTitle[_key=="${metaTitleKey}"].value`}],
      },
    ],
  }

  console.log('\n--- Request ---')
  console.log(JSON.stringify(params, null, 2))

  try {
    const result = await (client as any).agent.action.translate(params)
    console.log('\n--- Response document ---')
    console.log(JSON.stringify(result, null, 2))

    // Check where values ended up
    console.log('\n--- Value locations ---')
    const bioEntries = result?.bio
    if (Array.isArray(bioEntries)) {
      for (const entry of bioEntries) {
        console.log(`  bio[_key="${entry._key}"] lang=${entry.language} value="${entry.value}"`)
      }
    } else {
      console.log('  bio: not an array or missing')
    }

    const metaTitleEntries = result?.seo?.metaTitle
    if (Array.isArray(metaTitleEntries)) {
      for (const entry of metaTitleEntries) {
        console.log(
          `  seo.metaTitle[_key="${entry._key}"] lang=${entry.language} value="${entry.value}"`,
        )
      }
    } else {
      console.log('  seo.metaTitle: not an array or missing')
    }

    return {success: true, result}
  } catch (err: any) {
    console.log('\n--- Error ---')
    console.log(`Status: ${err.statusCode ?? 'unknown'}`)
    console.log(`Message: ${err.message}`)
    if (err.body) console.log(`Body: ${JSON.stringify(err.body, null, 2)}`)
    return {success: false, error: err.message}
  }
}

async function cleanup() {
  try {
    await client.delete(TEST_DOC_ID)
    await client.delete(`drafts.${TEST_DOC_ID}`)
  } catch {
    // Ignore — may not exist
  }
}

async function main() {
  console.log('\n=== Test: fieldLanguageMap + noWrite response shape ===')
  console.log('='.repeat(60))

  try {
    const {bioKey, metaTitleKey} = await setup()
    console.log(`\nSetup complete. bioKey=${bioKey}, metaTitleKey=${metaTitleKey}`)

    const result = await testBatchTranslate(bioKey, metaTitleKey)

    console.log('\n' + '='.repeat(60))
    console.log(`Result: ${result.success ? 'PASS' : 'FAIL'}`)
  } finally {
    await cleanup()
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  cleanup().finally(() => process.exit(1))
})
