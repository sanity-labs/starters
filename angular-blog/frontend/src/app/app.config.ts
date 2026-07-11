import {ApplicationConfig, makeStateKey, TransferState} from '@angular/core'
import {provideClientHydration, withEventReplay} from '@angular/platform-browser'
import {provideRouter} from '@angular/router'
import {provideBrowserGlobalErrorListeners} from '@angular/core'
import {PUBLIC_ENV, type PublicEnv} from './env/public-env.token'
import {routes} from './app.routes'

export const PUBLIC_ENV_KEY = makeStateKey<PublicEnv>('publicEnv')
export const DRAFT_MODE_KEY = makeStateKey<boolean>('draftMode')

const fallbackPublicEnv: PublicEnv = {
  projectId: '',
  dataset: 'production',
  studioUrl: 'http://localhost:3333',
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    {
      provide: PUBLIC_ENV,
      useFactory: (transferState: TransferState) =>
        transferState.get(PUBLIC_ENV_KEY, fallbackPublicEnv),
      deps: [TransferState],
    },
  ],
}
