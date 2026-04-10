import type {LayoutProps} from 'sanity'
import {LocalesProvider} from './LocalesContext'
import {GlossariesProvider} from './GlossariesContext'

export function L10nLayout(props: LayoutProps) {
  return (
    <LocalesProvider>
      <GlossariesProvider>{props.renderDefault(props)}</GlossariesProvider>
    </LocalesProvider>
  )
}
