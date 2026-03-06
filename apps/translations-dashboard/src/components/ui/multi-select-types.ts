import type {VariantProps} from 'class-variance-authority'
import type * as React from 'react'

import {cva} from 'class-variance-authority'

export interface AnimationConfig {
  badgeAnimation?: 'bounce' | 'fade' | 'none' | 'pulse' | 'slide' | 'wiggle'
  delay?: number
  duration?: number
  optionHoverAnimation?: 'glow' | 'highlight' | 'none' | 'scale'
  popoverAnimation?: 'fade' | 'flip' | 'none' | 'scale' | 'slide'
}

export const multiSelectVariants = cva('m-1', {
  defaultVariants: {
    badgeAnimation: 'none',
    variant: 'default',
  },
  variants: {
    badgeAnimation: {
      bounce: '',
      fade: '',
      none: '',
      pulse: '',
      slide: '',
      wiggle: '',
    },
    variant: {
      default: 'border-foreground/10 text-foreground bg-card',
      destructive: 'border-transparent bg-destructive text-destructive-foreground',
      inverted: 'inverted',
      secondary: 'border-foreground/10 bg-secondary text-secondary-foreground',
    },
  },
})

export interface MultiSelectGroup {
  heading: string
  options: MultiSelectOption[]
}

export interface MultiSelectOption {
  disabled?: boolean
  icon?: React.ComponentType<{className?: string}>
  label: string
  style?: {
    badgeColor?: string
    gradient?: string
    iconColor?: string
  }
  value: string
}

export interface MultiSelectProps
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'animationConfig'>,
    VariantProps<typeof multiSelectVariants> {
  animation?: number
  animationConfig?: AnimationConfig
  asChild?: boolean
  autoSize?: boolean
  className?: string
  closeOnSelect?: boolean
  deduplicateOptions?: boolean
  defaultValue?: string[]
  disabled?: boolean
  emptyIndicator?: React.ReactNode
  hideSelectAll?: boolean
  maxCount?: number
  maxWidth?: string
  minWidth?: string
  modalPopover?: boolean
  onValueChange: (value: string[]) => void
  options: MultiSelectGroup[] | MultiSelectOption[]
  placeholder?: string
  popoverClassName?: string
  resetOnDefaultValueChange?: boolean
  responsive?:
    | {
        desktop?: {compactMode?: boolean; hideIcons?: boolean; maxCount?: number}
        mobile?: {compactMode?: boolean; hideIcons?: boolean; maxCount?: number}
        tablet?: {compactMode?: boolean; hideIcons?: boolean; maxCount?: number}
      }
    | boolean
  searchable?: boolean
  singleLine?: boolean
}

export interface MultiSelectRef {
  clear: () => void
  focus: () => void
  getSelectedValues: () => string[]
  reset: () => void
  setSelectedValues: (values: string[]) => void
}

export function getPopoverAnimationClass(config?: AnimationConfig): string {
  if (config?.popoverAnimation) {
    switch (config.popoverAnimation) {
      case 'fade':
        return 'animate-fadeIn'
      case 'flip':
        return 'animate-flipIn'
      case 'none':
        return ''
      case 'scale':
        return 'animate-scaleIn'
      case 'slide':
        return 'animate-slideInDown'
      default:
        return ''
    }
  }
  return ''
}

export function isGroupedOptions(
  opts: MultiSelectGroup[] | MultiSelectOption[],
): opts is MultiSelectGroup[] {
  return opts.length > 0 && 'heading' in opts[0]
}
