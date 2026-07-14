/** Sanity Swag Store color blocks. Shared by banner and editorial tile themes. */
export const THEME_OPTIONS = [
  {title: 'Yellow', value: 'yellow'},
  {title: 'Orange', value: 'orange'},
  {title: 'Blue', value: 'blue'},
  {title: 'Black', value: 'black'},
  {title: 'Gray', value: 'gray'},
] as const

export type ThemeValue = (typeof THEME_OPTIONS)[number]['value']
