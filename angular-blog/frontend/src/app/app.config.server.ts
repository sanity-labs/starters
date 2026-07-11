import {
  APP_INITIALIZER,
  mergeApplicationConfig,
  ApplicationConfig,
  REQUEST,
  TransferState,
} from '@angular/core'
import {provideServerRendering, withRoutes} from '@angular/ssr'
import {appConfig, DRAFT_MODE_KEY, PUBLIC_ENV_KEY} from './app.config'
import {serverRoutes} from './app.routes.server'
import {PUBLIC_ENV} from './env/public-env.token'
import {cookiesFromRequest, isDraftModeRequest} from './sanity/draft-mode.shared'
import {SERVER_ENV} from './sanity/server-env.token'
import {getPublicEnv, getServerEnv} from '../server/env'

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {provide: PUBLIC_ENV, useFactory: () => getPublicEnv()},
    {
      provide: SERVER_ENV,
      useFactory: () => {
        const {readToken} = getServerEnv()
        return {readToken}
      },
    },
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: (transferState: TransferState, request: Request | null) => () => {
        transferState.set(PUBLIC_ENV_KEY, getPublicEnv())
        transferState.set(DRAFT_MODE_KEY, isDraftModeRequest(cookiesFromRequest(request)))
      },
      deps: [TransferState, REQUEST],
    },
  ],
}

export const config = mergeApplicationConfig(appConfig, serverConfig)
