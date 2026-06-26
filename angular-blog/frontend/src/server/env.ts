import {join} from 'path'
import {fileURLToPath} from 'url'
import type {PublicEnv} from '../app/env/public-env'

const rootDir = join(fileURLToPath(new URL('.', import.meta.url)), '../..')

try {
  process.loadEnvFile(join(rootDir, '.env.local'))
} catch {
  try {
    process.loadEnvFile(join(rootDir, '.env'))
  } catch {
    // optional in CI
  }
}

export type ServerEnv = {
  projectId: string
  dataset: string
  readToken: string | undefined
  studioUrl: string
  previewUrl: string
}

export function getServerEnv(): ServerEnv {
  return {
    projectId: process.env['SANITY_STUDIO_PROJECT_ID'] ?? '',
    dataset: process.env['SANITY_STUDIO_DATASET'] ?? 'production',
    readToken: process.env['SANITY_API_READ_TOKEN'],
    studioUrl: process.env['SANITY_STUDIO_URL'] ?? 'http://localhost:3333',
    previewUrl: process.env['SANITY_STUDIO_PREVIEW_URL'] ?? 'http://localhost:4200',
  }
}

export function getPublicEnv(): PublicEnv {
  const {projectId, dataset, studioUrl} = getServerEnv()
  return {projectId, dataset, studioUrl}
}
