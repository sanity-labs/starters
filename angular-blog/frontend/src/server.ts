import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node'
import cookieParser from 'cookie-parser'
import express from 'express'
import {join} from 'node:path'
import {
  handleDraftModeDisable,
  handleDraftModeEnable,
  handleDraftModePerspective,
} from './server/draft-mode'
import './server/env'

const browserDistFolder = join(import.meta.dirname, '../browser')
const app = express()
const angularApp = new AngularNodeAppEngine()

app.use(cookieParser())

// API routes BEFORE Angular SSR (order matters for Presentation tool)
app.get('/api/draft-mode/enable', (req, res) => {
  void handleDraftModeEnable(req, res).catch((error: unknown) => {
    console.error('Failed to enable draft mode:', error)
    if (!res.headersSent) {
      res.status(500).send('Failed to enable draft mode')
    }
  })
})
app.get('/api/draft-mode/disable', (req, res) => {
  handleDraftModeDisable(req, res)
})
app.get('/api/draft-mode/perspective', (req, res) => {
  handleDraftModePerspective(req, res)
})

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
)

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next)
})

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4200
  app.listen(port, (error) => {
    if (error) throw error
    console.log(`Angular blog listening on http://localhost:${port}`)
  })
}

export const reqHandler = createNodeRequestHandler(app)
