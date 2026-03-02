interface LocaleFallbackMessageProps {
  buttonText?: string
  message?: string
  onButtonClick?: () => void
  suggestion?: string
  title?: string
  variant?: 'error' | 'info' | 'warning'
}

function LocaleFallbackMessage({
  buttonText = 'Refresh Page',
  message = 'The app could not load any supported languages.',
  onButtonClick,
  suggestion = 'Try refreshing the page, or check your Sanity configuration to ensure locale documents exist.',
  title = 'No Languages Found',
  variant = 'warning',
}: LocaleFallbackMessageProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'error':
        return {
          button: 'bg-red-100 hover:bg-red-200 text-red-800',
          container: 'bg-red-50 border-red-200',
          message: 'text-red-700',
          suggestion: 'text-red-600',
          title: 'text-red-800',
        }
      case 'info':
        return {
          button: 'bg-blue-100 hover:bg-blue-200 text-blue-800',
          container: 'bg-blue-50 border-blue-200',
          message: 'text-blue-700',
          suggestion: 'text-blue-600',
          title: 'text-blue-800',
        }
      case 'warning':
      default:
        return {
          button: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800',
          container: 'bg-yellow-50 border-yellow-200',
          message: 'text-yellow-700',
          suggestion: 'text-yellow-600',
          title: 'text-yellow-800',
        }
    }
  }

  const styles = getVariantStyles()

  const handleButtonClick = () => {
    if (onButtonClick) {
      onButtonClick()
    } else {
      // Default behavior: refresh the page
      window.location.reload()
    }
  }

  return (
    <div className={`relative mb-2 p-4 border rounded-md ${styles.container}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className={`text-sm font-medium mb-2 ${styles.title}`}>{title}</h3>
          <p className={`text-sm mb-2 ${styles.message}`}>{message}</p>
          <p className={`text-xs ${styles.suggestion}`}>{suggestion}</p>
        </div>
        <button
          className={`px-3 py-2 text-sm rounded-md transition-colors ${styles.button}`}
          onClick={handleButtonClick}
        >
          {buttonText}
        </button>
      </div>
    </div>
  )
}

export default LocaleFallbackMessage
