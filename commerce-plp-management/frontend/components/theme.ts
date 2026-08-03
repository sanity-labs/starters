export type ThemeValue = 'yellow' | 'orange' | 'blue' | 'black' | 'gray' | string | null | undefined

type ThemeClasses = {bg: string; text: string; isDark: boolean}

const MAP: Record<string, ThemeClasses> = {
  yellow: {bg: 'bg-swag-yellow', text: 'text-swag-black', isDark: false},
  orange: {bg: 'bg-swag-orange', text: 'text-swag-black', isDark: false},
  blue: {bg: 'bg-swag-blue', text: 'text-white', isDark: true},
  black: {bg: 'bg-swag-black', text: 'text-white', isDark: true},
  gray: {bg: 'bg-swag-gray', text: 'text-white', isDark: true},
}

export function themeClasses(theme: ThemeValue): ThemeClasses {
  return MAP[theme ?? 'yellow'] ?? MAP.yellow
}
