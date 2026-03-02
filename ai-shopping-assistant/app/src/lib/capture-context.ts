// Browser-specific context capture functions for the agent.
// For types and constants, see ./client-tools.ts

import html2canvas from 'html2canvas-pro'
import TurndownService from 'turndown'

import type {UserContext} from './client-tools'

// Attribute to mark the agent chat element (excluded from capture)
export const AGENT_CHAT_HIDDEN_ATTRIBUTE = 'agent-chat-hidden'

// Captures lightweight user context.
// Sent with every message so the agent knows where the user is.
export function captureUserContext(): UserContext {
  const metaDescription =
    document.querySelector('meta[name="description"]')?.getAttribute('content') ||
    document.querySelector('meta[property="og:description"]')?.getAttribute('content')

  return {
    documentTitle: document.title,
    documentDescription: metaDescription || undefined,
    documentLocation: window.location.pathname,
  }
}

// Captures page context for the agent as markdown.
export function capturePageContext() {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
  })

  // Replace images with just alt text (no URLs)
  turndown.addRule('images', {
    filter: 'img',
    replacement: (_content, node) => {
      const alt = (node as HTMLImageElement).alt
      return alt ? alt : ''
    },
  })

  // Remove scripts, styles, svgs, videos
  turndown.addRule('removeNoise', {
    filter: (node) =>
      ['SCRIPT', 'STYLE', 'SVG', 'VIDEO', 'AUDIO', 'IFRAME', 'NOSCRIPT'].includes(node.nodeName),
    replacement: () => '',
  })

  const main = document.querySelector('main') || document.body
  const clone = main.cloneNode(true) as Element

  // Remove agent chat from the clone
  clone.querySelectorAll(`[${AGENT_CHAT_HIDDEN_ATTRIBUTE}]`).forEach((el) => el.remove())

  return {
    url: window.location.href,
    title: document.title,
    content: turndown.turndown(clone.innerHTML).slice(0, 4000),
  }
}

// Screenshot capture for visual context
export async function captureScreenshot() {
  const canvas = await html2canvas(document.body, {
    ignoreElements: (el) => el.hasAttribute(AGENT_CHAT_HIDDEN_ATTRIBUTE),
  })

  // Resize if needed (Anthropic max is 8000px, we use 4000 for safety + smaller payload)
  const MAX_DIMENSION = 4000
  let finalCanvas = canvas

  if (canvas.width > MAX_DIMENSION || canvas.height > MAX_DIMENSION) {
    const scale = Math.min(MAX_DIMENSION / canvas.width, MAX_DIMENSION / canvas.height)
    const resizedCanvas = document.createElement('canvas')
    resizedCanvas.width = Math.floor(canvas.width * scale)
    resizedCanvas.height = Math.floor(canvas.height * scale)
    const ctx = resizedCanvas.getContext('2d')
    ctx?.drawImage(canvas, 0, 0, resizedCanvas.width, resizedCanvas.height)
    finalCanvas = resizedCanvas
  }

  return finalCanvas.toDataURL('image/jpeg', 0.7)
}
