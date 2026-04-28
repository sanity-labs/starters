import {type DocumentActionDescription, type DocumentActionProps} from 'sanity'
import {LaunchIcon} from '@sanity/icons'

export function OpenResendAction(props: DocumentActionProps): DocumentActionDescription {
  const doc = props.draft || props.published
  const broadcastId = doc?.externalCampaignId as string | undefined

  const url = broadcastId
    ? `https://resend.com/broadcasts/${broadcastId}`
    : 'https://resend.com/broadcasts'

  return {
    label: broadcastId ? 'View in Resend' : 'Open Resend',
    icon: LaunchIcon,
    onHandle: () => {
      window.open(url, '_blank')
    },
  }
}
