import {type DocumentActionDescription, type DocumentActionProps} from 'sanity'
import {LaunchIcon} from '@sanity/icons'

export function OpenKlaviyoAction(props: DocumentActionProps): DocumentActionDescription {
  return {
    label: 'Open Klaviyo',
    icon: LaunchIcon,
    onHandle: () => {
      window.open('https://www.klaviyo.com/lists', '_blank')
    },
  }
}
