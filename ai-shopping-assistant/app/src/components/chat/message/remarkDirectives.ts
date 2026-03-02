import type {Node, Parent} from 'unist'
import {visit} from 'unist-util-visit'

interface DirectiveNode extends Node {
  type: 'textDirective' | 'leafDirective' | 'containerDirective'
  name: string
  attributes?: Record<string, string>
  children?: Node[]
  data?: {
    hName?: string
    hProperties?: Record<string, unknown>
  }
}

interface TextNode extends Node {
  type: 'text'
  value: string
}

interface ListNode extends Parent {
  type: 'list'
  children: ListItemNode[]
}

interface ListItemNode extends Parent {
  type: 'listItem'
  children: Node[]
}

const DIRECTIVE_TYPES = ['textDirective', 'leafDirective', 'containerDirective'] as const

/** Validate directive has a proper name (letters/hyphens only, prevents :02 in "14:02") */
function isDirectiveNode(node: Node): node is DirectiveNode {
  return (
    'name' in node &&
    typeof (node as DirectiveNode).name === 'string' &&
    /^[a-zA-Z-]+$/.test((node as DirectiveNode).name) &&
    DIRECTIVE_TYPES.includes(node.type as (typeof DIRECTIVE_TYPES)[number])
  )
}

function pascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

// Check if list item contains only a directive (for extraction)
function isListItemWithOnlyDirective(node: Node): boolean {
  if (node.type !== 'listItem') return false
  const children = (node as ListItemNode).children || []
  if (children.length !== 1) return false
  return children[0].type === 'leafDirective'
}

/* Remark plugin: four-step directive processing pipeline.
   1. Convert invalid directives to escaped text (prevents ":02" in timestamps from matching)
   2. Extract directives from list items into block-level nodes
   3. Remove incomplete directives during streaming (e.g., ":doc[" without closing)
   4. Transform valid directives into React component data (hName, hProperties) */
export function remarkDirectives() {
  return (tree: Node) => {
    // 1. Convert invalid directives to escaped text
    visit(tree, DIRECTIVE_TYPES, (node: Node, index, parent) => {
      if (!isDirectiveNode(node)) {
        if (parent && typeof index === 'number' && 'children' in parent) {
          const nodeName = 'name' in node && typeof node.name === 'string' ? node.name : ''
          ;(parent as Parent).children[index] = {type: 'text', value: `:${nodeName}`} as TextNode
        }
      }
    })

    // 2. Extract directives from list items
    visit(tree, 'list', (node: Node, index, parent) => {
      const listNode = node as ListNode
      if (!listNode.children) return

      const transformedChildren: Node[] = []
      let hasTransformed = false

      for (const child of listNode.children) {
        if (isListItemWithOnlyDirective(child)) {
          const directive = (child as ListItemNode).children?.[0]
          if (directive) {
            transformedChildren.push(directive)
            hasTransformed = true
          }
        } else {
          transformedChildren.push(child)
        }
      }

      if (hasTransformed && transformedChildren.every(isDirectiveNode)) {
        if (parent && typeof index === 'number' && 'children' in parent) {
          ;(parent as Parent).children.splice(index, 1, ...transformedChildren)
        }
      }
    })

    // 3. Remove incomplete directives during streaming
    visit(tree, 'text', (node: Node) => {
      const textNode = node as TextNode
      if (typeof textNode.value !== 'string') return
      const text = textNode.value
      if (
        text.match(/::(?!:)\w+\[/) ||
        text.match(/:(?!:)\w+\[/) ||
        text.match(/::(?!:)\w+\{/) ||
        text.match(/:(?!:)\w+\{/)
      ) {
        textNode.value = ''
      }
    })

    // 4. Transform valid directives to React components
    visit(tree, DIRECTIVE_TYPES, (node: Node) => {
      if (!isDirectiveNode(node)) return

      node.data = node.data || {}
      node.data.hName = pascalCase(node.name)
      node.data.hProperties = {
        ...node.attributes,
        isInline: node.type === 'textDirective',
      }
    })
  }
}
