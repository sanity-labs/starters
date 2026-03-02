import {Card, Text} from '@sanity/ui'
import React, {Component, type ReactNode} from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error?: Error
  hasError: boolean
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {hasError: false}
  }

  static getDerivedStateFromError(error: Error): State {
    return {error, hasError: true}
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Card padding={4} tone="critical">
          <Text>Something went wrong loading the data.</Text>
          {this.state.error && (
            <Text muted size={1}>
              {this.state.error.message}
            </Text>
          )}
        </Card>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
