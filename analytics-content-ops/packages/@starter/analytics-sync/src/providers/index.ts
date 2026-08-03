import type {AnalyticsProvider} from '../types'
import {fixtureProvider} from './fixture'
import {ga4Provider} from './ga4'

// Select a provider from an environment string so the same sync entrypoint
// works in the demo (fixture) and in production (ga4, or your own adapter).
export function resolveProvider(name = 'fixture'): AnalyticsProvider {
  switch (name.toLowerCase()) {
    case 'ga4':
      return ga4Provider()
    case 'fixture':
    default:
      return fixtureProvider()
  }
}

export {fixtureProvider} from './fixture'
export {ga4Provider} from './ga4'
