/**
 * Schema walking hook — discovers all `internationalizedArray*` fields in a document type.
 *
 * Recursively walks the compiled schema at runtime, descending into object fields
 * and array member types. Uses `useMemo` keyed on documentType so it computes once
 * per type (schema ref is stable across renders).
 *
 * Array-of-objects fields (e.g. `sections[].heading`) are detected but flagged
 * as depth -1 — they require runtime `_key` lookup and are deferred from the
 * inspector's bulk translate UI.
 */

import {useMemo} from 'react'
import {
  isArraySchemaType,
  isObjectSchemaType,
  useSchema,
  type ObjectSchemaType,
  type SchemaType,
} from 'sanity'

const I18N_PREFIX = 'internationalizedArray'

export interface InternationalizedFieldDescriptor {
  /** e.g. ['bio'] or ['hero', 'title'] */
  path: string[]
  /** e.g. 'bio' or 'hero.title' */
  displayPath: string
  /** e.g. 'Bio' or 'Hero > Title' */
  displayTitle: string
  /** e.g. 'internationalizedArrayText' */
  typeName: string
  /** e.g. 'text' or 'string' — derived from stripping the prefix */
  valueType: string
  /** 0 = top-level, 1 = inside an object, -1 = inside an array (deferred) */
  depth: number
}

function walkSchema(
  type: SchemaType,
  path: string[],
  titlePath: string[],
  depth: number,
  insideArray: boolean,
  visited: Set<string>,
  result: InternationalizedFieldDescriptor[],
): void {
  if (!isObjectSchemaType(type)) return

  const objectType = type as ObjectSchemaType
  if (!objectType.fields) return

  for (const field of objectType.fields) {
    const fieldType = field.type
    const fieldName = field.name
    const fieldTitle = field.type.title ?? fieldName

    if (fieldType.name?.startsWith(I18N_PREFIX)) {
      const valueType = fieldType.name.slice(I18N_PREFIX.length).toLowerCase()
      const fieldPath = [...path, fieldName]
      const fieldTitlePath = [...titlePath, fieldTitle]

      result.push({
        path: fieldPath,
        displayPath: fieldPath.join('.'),
        displayTitle: fieldTitlePath.join(' > '),
        typeName: fieldType.name,
        valueType,
        depth: insideArray ? -1 : depth,
      })
      continue
    }

    // Recurse into object fields
    if (isObjectSchemaType(fieldType)) {
      const typeName = fieldType.name
      if (typeName && visited.has(typeName)) continue
      if (typeName) visited.add(typeName)

      walkSchema(
        fieldType,
        [...path, fieldName],
        [...titlePath, fieldTitle],
        depth + 1,
        insideArray,
        visited,
        result,
      )

      if (typeName) visited.delete(typeName)
    }

    // Recurse into array member types
    if (isArraySchemaType(fieldType) && fieldType.of) {
      for (const memberType of fieldType.of) {
        if (memberType.name?.startsWith(I18N_PREFIX)) {
          // The array itself is an internationalized array — already handled above
          continue
        }

        if (isObjectSchemaType(memberType)) {
          const typeName = memberType.name
          if (typeName && visited.has(typeName)) continue
          if (typeName) visited.add(typeName)

          walkSchema(
            memberType,
            [...path, fieldName],
            [...titlePath, fieldTitle],
            depth + 1,
            true, // inside array — fields here are deferred
            visited,
            result,
          )

          if (typeName) visited.delete(typeName)
        }
      }
    }
  }
}

/**
 * Hook that discovers all `internationalizedArray*` fields in a document type.
 *
 * Returns a stable array of field descriptors. Fields inside array-of-objects
 * are included with `depth: -1` to indicate they need runtime key resolution
 * and are not yet supported for bulk translate.
 */
export function useInternationalizedFields(
  documentType: string,
): InternationalizedFieldDescriptor[] {
  const schema = useSchema()

  return useMemo(() => {
    const docType = schema.get(documentType)
    if (!docType) return []

    const result: InternationalizedFieldDescriptor[] = []
    const visited = new Set<string>()
    walkSchema(docType, [], [], 0, false, visited, result)
    return result
  }, [schema, documentType])
}
