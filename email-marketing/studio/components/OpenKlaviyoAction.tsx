import {type DocumentActionDescription, type DocumentActionProps} from 'sanity'
import {LaunchIcon} from '@sanity/icons'

export function OpenKlaviyoAction(props: DocumentActionProps): DocumentActionDescription {
  const doc = props.draft || props.published
  const campaignId = doc?.externalCampaignId as string | undefined

  const url = campaignId
    ? `https://www.klaviyo.com/campaign/${campaignId}/reports`
    : 'https://www.klaviyo.com/campaigns'

  return {
    label: campaignId ? 'View in Klaviyo' : 'Open Klaviyo',
    icon: LaunchIcon,
    onHandle: () => {
      window.open(url, '_blank')
    },
  }
}
