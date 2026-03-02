import {Flex} from '@sanity/ui'

export function ClickableTranslationItem({
  badgeBgColor,
  borderClassName,
  children,
  disabled,
  languageId,
  onClick,
  rightContent,
}: {
  badgeBgColor: string
  borderClassName: string
  children: React.ReactNode
  disabled?: boolean
  languageId: string
  onClick?: () => void
  rightContent?: React.ReactNode
}) {
  const cleanBorderClassName = disabled
    ? borderClassName.replace(/hover:[^\s]+/g, '').trim()
    : borderClassName

  return (
    <button
      className={`w-full text-left rounded-md p-3 transition-colors min-h-[3.25rem] ${disabled ? '' : 'cursor-pointer'} ${cleanBorderClassName}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Flex align="center" className="flex-1 min-w-0" gap={2} justify="space-between" wrap="wrap">
        <Flex align="center" className="min-w-0" gap={2}>
          <div
            className={`transition-all duration-200 px-2 py-1 text-white text-xs rounded-full w-14 flex-shrink-0 text-center ${disabled ? '' : 'cursor-pointer'} ${badgeBgColor}`}
          >
            {languageId}
          </div>
          {children}
        </Flex>
        {rightContent}
      </Flex>
    </button>
  )
}
