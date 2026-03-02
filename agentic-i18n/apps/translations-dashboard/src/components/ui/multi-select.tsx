import {Button} from '@sanity/ui'
import * as React from 'react'

import {Popover, PopoverContent, PopoverTrigger} from '#components/ui/popover'
import {useMultiSelect} from '#hooks/useMultiSelect'
import {cn} from '#lib/utils'

import type {MultiSelectProps, MultiSelectRef} from './multi-select-types'

import {MultiSelectDropdown} from './multi-select-dropdown'
import {MultiSelectTriggerContent} from './multi-select-trigger'
import {getPopoverAnimationClass} from './multi-select-types'

export type {
  AnimationConfig,
  MultiSelectGroup,
  MultiSelectOption,
  MultiSelectProps,
} from './multi-select-types'
export type {MultiSelectRef} from './multi-select-types'

export const MultiSelect = React.forwardRef<MultiSelectRef, MultiSelectProps>(
  (
    {
      animation = 0,
      animationConfig,
      autoSize = false,
      className,
      closeOnSelect = false,
      deduplicateOptions = false,
      defaultValue = [],
      disabled = false,
      emptyIndicator,
      hideSelectAll = false,
      maxCount = 3,
      maxWidth,
      minWidth,
      modalPopover = false,
      onValueChange,
      options,
      placeholder = 'Select options',
      popoverClassName,
      resetOnDefaultValueChange = true,
      responsive,
      searchable = true,
      singleLine = false,
      variant,
      ...props
    },
    ref,
  ) => {
    const {
      filteredOptions,
      getAllOptions,
      getOptionByValue,
      handleInputKeyDown,
      isPopoverOpen,
      resetToDefault,
      searchValue,
      selectedValues,
      setIsPopoverOpen,
      setSearchValue,
      setSelectedValues,
      toggleAll,
      toggleOption,
    } = useMultiSelect({
      closeOnSelect,
      deduplicateOptions,
      defaultValue,
      disabled,
      onValueChange,
      options,
      resetOnDefaultValueChange,
      searchable,
    })

    // Accessibility announcements
    const [politeMessage, setPoliteMessage] = React.useState('')
    const [assertiveMessage, setAssertiveMessage] = React.useState('')
    const prevSelectedCount = React.useRef(selectedValues.length)
    const prevIsOpen = React.useRef(isPopoverOpen)
    const prevSearchValue = React.useRef(searchValue)

    const announce = React.useCallback(
      (message: string, priority: 'assertive' | 'polite' = 'polite') => {
        if (priority === 'assertive') {
          setAssertiveMessage(message)
          setTimeout(() => setAssertiveMessage(''), 100)
        } else {
          setPoliteMessage(message)
          setTimeout(() => setPoliteMessage(''), 100)
        }
      },
      [],
    )

    const multiSelectId = React.useId()
    const listboxId = `${multiSelectId}-listbox`
    const triggerDescriptionId = `${multiSelectId}-description`
    const selectedCountId = `${multiSelectId}-count`
    const buttonRef = React.useRef<HTMLButtonElement>(null)

    React.useImperativeHandle(
      ref,
      () => ({
        clear: () => {
          setSelectedValues([])
          onValueChange([])
        },
        focus: () => {
          if (buttonRef.current) {
            buttonRef.current.focus()
            const orig = buttonRef.current.style.outline
            const origOffset = buttonRef.current.style.outlineOffset
            buttonRef.current.style.outline = '2px solid hsl(var(--ring))'
            buttonRef.current.style.outlineOffset = '2px'
            setTimeout(() => {
              if (buttonRef.current) {
                buttonRef.current.style.outline = orig
                buttonRef.current.style.outlineOffset = origOffset
              }
            }, 1000)
          }
        },
        getSelectedValues: () => selectedValues,
        reset: resetToDefault,
        setSelectedValues: (values: string[]) => {
          setSelectedValues(values)
          onValueChange(values)
        },
      }),
      [resetToDefault, selectedValues, onValueChange, setSelectedValues],
    )

    const [screenSize, setScreenSize] = React.useState<'desktop' | 'mobile' | 'tablet'>('desktop')
    React.useEffect(() => {
      if (typeof window === 'undefined') return
      const handleResize = () => {
        const w = window.innerWidth
        if (w < 640) setScreenSize('mobile')
        else if (w < 1024) setScreenSize('tablet')
        else setScreenSize('desktop')
      }
      handleResize()
      window.addEventListener('resize', handleResize)
      return () => {
        if (typeof window !== 'undefined') window.removeEventListener('resize', handleResize)
      }
    }, [])

    const responsiveSettings = React.useMemo(() => {
      if (!responsive) return {compactMode: false, hideIcons: false, maxCount}
      if (responsive === true) {
        const defaults = {
          desktop: {compactMode: false, hideIcons: false, maxCount: 6},
          mobile: {compactMode: true, hideIcons: false, maxCount: 2},
          tablet: {compactMode: false, hideIcons: false, maxCount: 4},
        }
        const s = defaults[screenSize]
        return {
          compactMode: s?.compactMode ?? false,
          hideIcons: s?.hideIcons ?? false,
          maxCount: s?.maxCount ?? maxCount,
        }
      }
      const s = responsive[screenSize]
      return {
        compactMode: s?.compactMode ?? false,
        hideIcons: s?.hideIcons ?? false,
        maxCount: s?.maxCount ?? maxCount,
      }
    }, [responsive, screenSize, maxCount])

    const clearExtraOptions = React.useCallback(() => {
      if (disabled) return
      const newValues = selectedValues.slice(0, responsiveSettings.maxCount)
      setSelectedValues(newValues)
      onValueChange(newValues)
    }, [disabled, selectedValues, responsiveSettings.maxCount, setSelectedValues, onValueChange])

    const widthConstraints = React.useMemo(() => {
      const defaultMinWidth = screenSize === 'mobile' ? '0px' : '200px'
      return {
        maxWidth: maxWidth || '100%',
        minWidth: minWidth || defaultMinWidth,
        width: autoSize ? 'auto' : '100%',
      }
    }, [screenSize, maxWidth, minWidth, autoSize])

    // A11y effect
    React.useEffect(() => {
      const count = selectedValues.length
      const allOpts = getAllOptions()
      const total = allOpts.filter((o) => !o.disabled).length

      if (count !== prevSelectedCount.current) {
        const diff = count - prevSelectedCount.current
        if (diff > 0) {
          const added = selectedValues
            .slice(-diff)
            .map((v) => allOpts.find((o) => o.value === v)?.label)
            .filter(Boolean)
          announce(
            added.length === 1
              ? `${added[0]} selected. ${count} of ${total} options selected.`
              : `${added.length} options selected. ${count} of ${total} total selected.`,
          )
        } else {
          announce(`Option removed. ${count} of ${total} options selected.`)
        }
        prevSelectedCount.current = count
      }

      if (isPopoverOpen !== prevIsOpen.current) {
        announce(
          isPopoverOpen
            ? `Dropdown opened. ${total} options available. Use arrow keys to navigate.`
            : 'Dropdown closed.',
        )
        prevIsOpen.current = isPopoverOpen
      }

      if (searchValue !== prevSearchValue.current && searchValue !== undefined) {
        if (searchValue && isPopoverOpen) {
          const n = allOpts.filter(
            (o) =>
              o.label.toLowerCase().includes(searchValue.toLowerCase()) ||
              o.value.toLowerCase().includes(searchValue.toLowerCase()),
          ).length
          announce(`${n} option${n === 1 ? '' : 's'} found for "${searchValue}"`)
        }
        prevSearchValue.current = searchValue
      }
    }, [selectedValues, isPopoverOpen, searchValue, announce, getAllOptions])

    return (
      <>
        <div className="sr-only">
          <div aria-atomic="true" aria-live="polite" role="status">
            {politeMessage}
          </div>
          <div aria-atomic="true" aria-live="assertive" role="alert">
            {assertiveMessage}
          </div>
        </div>

        <Popover modal={modalPopover} onOpenChange={setIsPopoverOpen} open={isPopoverOpen}>
          <div className="sr-only" id={triggerDescriptionId}>
            Multi-select dropdown. Use arrow keys to navigate, Enter to select, and Escape to close.
          </div>
          <div aria-live="polite" className="sr-only" id={selectedCountId}>
            {selectedValues.length === 0
              ? 'No options selected'
              : `${selectedValues.length} option${selectedValues.length === 1 ? '' : 's'} selected: ${selectedValues
                  .map((v) => getOptionByValue(v)?.label)
                  .filter(Boolean)
                  .join(', ')}`}
          </div>

          <PopoverTrigger asChild>
            <Button
              ref={buttonRef}
              {...props}
              aria-controls={isPopoverOpen ? listboxId : undefined}
              aria-describedby={`${triggerDescriptionId} ${selectedCountId}`}
              aria-expanded={isPopoverOpen}
              aria-haspopup="listbox"
              aria-label={`Multi-select: ${selectedValues.length} of ${getAllOptions().length} options selected. ${placeholder}`}
              className={cn(
                'flex rounded-md border min-h-13 h-auto items-center justify-between bg-inherit hover:bg-inherit [&_svg]:pointer-events-auto',
                autoSize ? 'w-auto' : 'w-full',
                responsiveSettings.compactMode && 'min-h-8 text-sm',
                screenSize === 'mobile' && 'min-h-12 text-base',
                disabled && 'opacity-50 cursor-not-allowed',
                className,
              )}
              disabled={disabled}
              mode="ghost"
              onClick={() => !disabled && setIsPopoverOpen((prev) => !prev)}
              role="combobox"
              style={{...widthConstraints, maxWidth: `min(${widthConstraints.maxWidth}, 100%)`}}
              tone="default"
            >
              <MultiSelectTriggerContent
                animation={animation}
                animationConfig={animationConfig}
                getOptionByValue={getOptionByValue}
                onClearExtra={clearExtraOptions}
                onToggleOption={toggleOption}
                placeholder={placeholder}
                responsiveSettings={responsiveSettings}
                screenSize={screenSize}
                selectedValues={selectedValues}
                singleLine={singleLine}
                variant={variant}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            aria-label="Available options"
            aria-multiselectable="true"
            className={cn(
              'w-auto p-0',
              getPopoverAnimationClass(animationConfig),
              screenSize === 'mobile' && 'w-[85vw] max-w-[280px]',
              screenSize === 'tablet' && 'w-[70vw] max-w-md',
              screenSize === 'desktop' && 'min-w-[300px]',
              popoverClassName,
              'bg-white border-gray-300',
            )}
            id={listboxId}
            onEscapeKeyDown={() => setIsPopoverOpen(false)}
            role="listbox"
            style={{
              animationDelay: `${animationConfig?.delay || 0}s`,
              animationDuration: `${animationConfig?.duration || animation}s`,
              maxHeight: screenSize === 'mobile' ? '70vh' : '60vh',
              maxWidth: `min(${widthConstraints.maxWidth}, 85vw)`,
              touchAction: 'manipulation',
            }}
          >
            <MultiSelectDropdown
              emptyIndicator={emptyIndicator}
              filteredOptions={filteredOptions}
              getAllOptions={getAllOptions}
              handleInputKeyDown={handleInputKeyDown}
              hideSelectAll={hideSelectAll}
              multiSelectId={multiSelectId}
              onSearchValueChange={setSearchValue}
              onToggleAll={toggleAll}
              onToggleOption={toggleOption}
              screenSize={screenSize}
              searchable={searchable}
              searchValue={searchValue}
              selectedValues={selectedValues}
            />
          </PopoverContent>
        </Popover>
      </>
    )
  },
)

MultiSelect.displayName = 'MultiSelect'
