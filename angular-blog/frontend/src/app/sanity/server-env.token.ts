import {InjectionToken} from '@angular/core'

export type ServerEnvConfig = {
  readToken?: string
}

export const SERVER_ENV = new InjectionToken<ServerEnvConfig>('SERVER_ENV')
