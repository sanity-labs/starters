import {documentEventHandler} from '@sanity/functions'

export const handler = documentEventHandler(async ({context, event}) => {
  const time = new Date().toLocaleTimeString()
  console.log(`Hello from Sanity Functions! Called at ${time}`)
  console.log('Event:', event)
})
