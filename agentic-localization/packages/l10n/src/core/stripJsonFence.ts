/**
 * Models fence their JSON whether or not the prompt asked for it, so every
 * response this package parses is unwrapped here first.
 */
export function stripJsonFence(raw: string): string {
  return raw.replace(/^```json\s*|\s*```$/g, '').trim()
}
