import {Card, Text} from '@sanity/ui'

const ErrorState = () => {
  return (
    <Card padding={5} tone="critical">
      <Text>Failed to load post details</Text>
    </Card>
  )
}

export default ErrorState
