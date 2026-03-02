import type * as React from 'react'

import {CloseCircleIcon} from '@sanity/icons'
import {Badge, Flex, Text} from '@sanity/ui'
import {ChevronDown} from 'lucide-react'

import {cn} from '#lib/utils'

import type {AnimationConfig, MultiSelectOption} from './multi-select-types'

import {multiSelectVariants} from './multi-select-types'

interface MultiSelectTriggerContentProps {
  animation: number
  animationConfig?: AnimationConfig
  getOptionByValue: (value: string) => MultiSelectOption | undefined
  onClearExtra: () => void
  onToggleOption: (value: string) => void
  placeholder: string
  responsiveSettings: {compactMode: boolean; hideIcons: boolean; maxCount: number}
  screenSize: 'desktop' | 'mobile' | 'tablet'
  selectedValues: string[]
  singleLine: boolean
  variant?: 'default' | 'destructive' | 'inverted' | 'secondary' | null
}

export function MultiSelectTriggerContent({
  animation,
  animationConfig,
  getOptionByValue,
  onClearExtra,
  onToggleOption,
  placeholder,
  responsiveSettings,
  screenSize,
  selectedValues,
  singleLine,
  variant,
}: MultiSelectTriggerContentProps) {
  if (selectedValues.length === 0) {
    return (
      <div className="flex items-center justify-between w-full mx-auto">
        <Text className="text-muted-foreground mx-3" size={1}>
          {placeholder}
        </Text>
        <ChevronDown className="h-4 cursor-pointer text-muted-foreground mx-2" />
      </div>
    )
  }

  return (
    <div className="flex justify-between items-center w-full">
      <div
        className={cn(
          'flex items-center gap-2',
          singleLine ? 'overflow-x-auto multiselect-singleline-scroll' : 'flex-wrap',
          responsiveSettings.compactMode && 'gap-0.5',
        )}
        style={singleLine ? {paddingBottom: 4} : undefined}
      >
        {selectedValues
          .slice(0, responsiveSettings.maxCount)
          .map((value) => {
            const option = getOptionByValue(value)
            if (!option) return null
            const IconComponent = option.icon
            const customStyle = option.style

            const badgeStyle: React.CSSProperties = {
              animationDuration: `${animation}s`,
              ...(customStyle?.badgeColor && {backgroundColor: customStyle.badgeColor}),
              ...(customStyle?.gradient && {background: customStyle.gradient, color: 'white'}),
            }

            return (
              <Badge
                className={cn(
                  multiSelectVariants({variant}),
                  customStyle?.gradient && 'text-white border-transparent',
                  responsiveSettings.compactMode && 'text-xs px-1.5 py-0.5',
                  screenSize === 'mobile' && 'max-w-[120px] truncate',
                  singleLine && 'flex-shrink-0 whitespace-nowrap',
                  '[&>svg]:pointer-events-auto',
                )}
                key={value}
                style={{
                  ...badgeStyle,
                  animationDelay: `${animationConfig?.delay || 0}s`,
                  animationDuration: `${animationConfig?.duration || animation}s`,
                  paddingBlock: 12,
                  paddingInline: 8,
                }}
                tone="primary"
              >
                <Flex align="center" gap={2}>
                  {IconComponent && !responsiveSettings.hideIcons && (
                    <IconComponent
                      className={cn(
                        'h-4 w-4',
                        responsiveSettings.compactMode && 'h-3 w-3',
                        customStyle?.iconColor && 'text-current',
                      )}
                      {...(customStyle?.iconColor && {
                        padding: 12,
                        style: {color: customStyle.iconColor},
                      })}
                    />
                  )}
                  <button
                    aria-label={`Remove ${option.label} from selection`}
                    className="flex cursor-pointer items-center justify-center border-none bg-none"
                    onClick={(event) => {
                      event.stopPropagation()
                      onToggleOption(value)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        event.stopPropagation()
                        onToggleOption(value)
                      }
                    }}
                    tabIndex={0}
                    type="button"
                  >
                    <CloseCircleIcon className="size-6 text-current" />
                  </button>
                  <Text className={cn(screenSize === 'mobile' && 'truncate')} size={1}>
                    {option.label}
                  </Text>
                </Flex>
              </Badge>
            )
          })
          .filter(Boolean)}
        {selectedValues.length > responsiveSettings.maxCount && (
          <Badge
            className={cn(
              multiSelectVariants({variant}),
              responsiveSettings.compactMode && 'text-xs px-1.5 py-0.5',
              singleLine && 'flex-shrink-0 whitespace-nowrap',
            )}
            style={{
              animationDelay: `${animationConfig?.delay || 0}s`,
              animationDuration: `${animationConfig?.duration || animation}s`,
              paddingBlock: 12,
              paddingInline: 8,
            }}
            tone="primary"
          >
            <Flex align="center" gap={2}>
              <button
                aria-label="Clear extra selections"
                className="flex cursor-pointer items-center justify-center border-none bg-none"
                onClick={(event) => {
                  event.stopPropagation()
                  onClearExtra()
                }}
                type="button"
              >
                <CloseCircleIcon className="size-6 text-current" />
              </button>
              <Text size={1}>{`${selectedValues.length - responsiveSettings.maxCount} more`}</Text>
            </Flex>
          </Badge>
        )}
      </div>

      <ChevronDown
        aria-hidden="true"
        className="h-4 mx-2 cursor-pointer text-muted-foreground relative left-[14px]"
      />
    </div>
  )
}
