import {InjectionToken} from '@angular/core'
import type {PublicEnv} from './public-env'

export type {PublicEnv} from './public-env'
export const PUBLIC_ENV = new InjectionToken<PublicEnv>('PUBLIC_ENV')
