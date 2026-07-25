import {BehaviorSubject, distinctUntilChanged, skip} from 'rxjs'

const STORAGE_KEY = 'l10n.localeFilter'
const SYMBOL_KEY = Symbol.for('l10n.localeFilter$')

/**
 * Whether localStorage is available and functional in the current environment.
 * Uses the MDN-recommended feature detection pattern: attempts a real write/remove
 * cycle to catch cases where the API exists but is disabled (e.g. private browsing).
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API#feature-detecting_localstorage
 */
const hasLocalStorage = (() => {
  try {
    const storage = globalThis.localStorage
    const x = '__storage_test__'
    storage.setItem(x, x)
    storage.getItem(x)
    storage.removeItem(x)
    return true
  } catch {
    return false
  }
})()

/** Reads the persisted locale filter from localStorage, returning `[]` if unavailable or invalid. */
function loadFilter(): string[] {
  if (!hasLocalStorage) return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
        return parsed
      }
    }
  } catch (err) {
    console.warn('[l10n] Failed to read locale filter from localStorage:', err)
  }
  return []
}

/**
 * Returns the singleton BehaviorSubject for the locale filter, creating it on first call.
 * Attaches a localStorage persistence subscription when storage is available.
 */
function isLocaleFilter(value: unknown): value is BehaviorSubject<string[]> {
  if (!(value instanceof BehaviorSubject)) return false
  const current: unknown = value.getValue()
  return Array.isArray(current) && current.every((v): v is string => typeof v === 'string')
}

function getOrCreateFilter(): BehaviorSubject<string[]> {
  const existing: unknown = Reflect.get(globalThis, SYMBOL_KEY)
  if (isLocaleFilter(existing)) {
    return existing
  }

  const subject = new BehaviorSubject<string[]>(loadFilter())
  Reflect.set(globalThis, SYMBOL_KEY, subject)

  if (hasLocalStorage) {
    subject
      .pipe(
        skip(1),
        distinctUntilChanged((a, b) => a.length === b.length && a.every((v, i) => v === b[i])),
      )
      .subscribe((locales) => {
        try {
          if (locales.length === 0) {
            localStorage.removeItem(STORAGE_KEY)
          } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(locales))
          }
        } catch (err) {
          console.warn('[l10n] Failed to persist locale filter to localStorage:', err)
        }
      })

    // Sync filter across tabs via the storage event (fires when another tab writes to localStorage).
    globalThis.addEventListener?.('storage', (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      const loaded = loadFilter()
      subject.next(loaded)
    })
  }

  return subject
}

/**
 * Global locale filter shared between the navbar dropdown and structure builder.
 * Empty array = show all locales (no filter active).
 * Persisted to localStorage so the selection survives page refreshes.
 *
 * Stored on globalThis via Symbol.for() so the subject is a true singleton
 * even if the module is bundled multiple times.
 */
export const globalLocaleFilter$ = getOrCreateFilter()
