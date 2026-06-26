import {
  APP_INITIALIZER,
  mergeApplicationConfig,
  ApplicationConfig,
  TransferState,
} from '@angular/core'
import {provideServerRendering, withRoutes} from '@angular/ssr'
import {appConfig, PUBLIC_ENV_KEY} from './app.config'
import {serverRoutes} from './app.routes.server'
import {PUBLIC_ENV} from './env/public-env.token'
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
      useFactory: (transferState: TransferState) => () => {
        transferState.set(PUBLIC_ENV_KEY, getPublicEnv())
      },
      deps: [TransferState],
    },
  ],
}

export const config = mergeApplicationConfig(appConfig, serverConfig)
