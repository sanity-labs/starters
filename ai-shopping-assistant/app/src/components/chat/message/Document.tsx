import {Product} from './Product'

export interface DocumentProps {
  id: string
  type: string
  isInline?: boolean
}

// Routes document directives to type-specific render components.
// Add new cases here when adding renderers for other document types.
export function Document(props: DocumentProps) {
  if (props.type === 'product') {
    return <Product {...props} />
  }

  return null
}
