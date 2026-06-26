import {existsSync} from 'fs'
import {join} from 'path'
import {fileURLToPath} from 'url'
import type {PublicEnv} from '../app/env/public-env'

function tryLoadEnvFile(path: string): void {
  if (!existsSync(path)) return
  try {
    process.loadEnvFile(path)
  } catch {
    // optional in CI or when file is empty
  }
}

function loadEnvFiles(): void {
  const moduleDir = fileURLToPath(new URL('.', import.meta.url))
  const roots = [
    process.cwd(),
    join(process.cwd(), '..'),
    join(moduleDir, '../../..'), // frontend/src/server -> starter root (dev)
    join(moduleDir, '../../../..'), // dist/frontend/server -> starter root (prod)
  ]

  for (const root of roots) {
    tryLoadEnvFile(join(root, '.env'))
    tryLoadEnvFile(join(root, '.env.local'))
  }
}

loadEnvFiles()

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
