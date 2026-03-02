/**
 * Import sample-data.ndjson into the workspace dataset.
 *
 * Uses getCliClient() to resolve the dataset from sanity.cli.ts,
 * avoiding the need to pass the dataset name as a CLI argument.
 *
 * Usage:
 *   pnpm import-sample-data
 */

import {execFileSync} from 'node:child_process'
import {getCliClient} from 'sanity/cli'

const {dataset} = getCliClient().config()

execFileSync(
  'pnpm',
  ['exec', 'sanity', 'dataset', 'import', 'sample-data.ndjson', dataset!, '--replace'],
  {stdio: 'inherit'},
)
