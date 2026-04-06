import {type DocumentBadgeDescription, type DocumentBadgeProps} from 'sanity'

export function SendStatusBadge(props: DocumentBadgeProps): DocumentBadgeDescription | null {
  const {type, published} = props
  const doc = published

  if (type === 'emailMessage') {
    const sendState = doc?.sendState as string | undefined
    if (sendState === 'sent') return {label: 'Sent', color: 'success'}
    if (sendState === 'sending' || sendState === 'requested')
      return {label: 'Sending\u2026', color: 'primary'}
    if (sendState === 'error') return {label: 'Send Error', color: 'danger'}
    return null
  }

  return null
}
