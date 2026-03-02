import {ResetIcon} from '@sanity/icons'
import {Button, Card, Flex, Stack, Text} from '@sanity/ui'
import {Component, type ErrorInfo, type ReactNode} from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  featureName?: string
}

interface State {
  error: Error | null
  hasError: boolean
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {error: null, hasError: false}
  }

  static getDerivedStateFromError(error: Error): State {
    return {error, hasError: true}
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Error in ${this.props.featureName || 'component'}:`, error, errorInfo)
  }

  handleRetry = () => {
    this.setState({error: null, hasError: false})
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const label = this.props.featureName || 'Component'

      return (
        <Card padding={4} radius={2} tone="critical">
          <Stack space={3}>
            <Text size={1} weight="medium">
              Something went wrong in {label}.
            </Text>
            {this.state.error && (
              <Text muted size={0}>
                {this.state.error.message}
              </Text>
            )}
            <Flex>
              <Button
                fontSize={1}
                icon={ResetIcon}
                mode="ghost"
                onClick={this.handleRetry}
                text="Try again"
                tone="critical"
              />
            </Flex>
          </Stack>
        </Card>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
