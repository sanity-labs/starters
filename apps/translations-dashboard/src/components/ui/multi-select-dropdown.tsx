import {Button, Checkbox, Text} from '@sanity/ui'
import * as React from 'react'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#components/ui/command'
import {cn} from '#lib/utils'

import type {MultiSelectGroup, MultiSelectOption} from './multi-select-types'

import {isGroupedOptions} from './multi-select-types'

interface MultiSelectDropdownProps {
  emptyIndicator?: React.ReactNode
  filteredOptions: MultiSelectGroup[] | MultiSelectOption[]
  getAllOptions: () => MultiSelectOption[]
  handleInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
  hideSelectAll: boolean
  multiSelectId: string
  onSearchValueChange: (value: string) => void
  onToggleAll: () => void
  onToggleOption: (value: string) => void
  screenSize: 'desktop' | 'mobile' | 'tablet'
  searchable: boolean
  searchValue: string
  selectedValues: string[]
}

export function MultiSelectDropdown({
  emptyIndicator,
  filteredOptions,
  getAllOptions,
  handleInputKeyDown,
  hideSelectAll,
  multiSelectId,
  onSearchValueChange,
  onToggleAll,
  onToggleOption,
  screenSize,
  searchable,
  searchValue,
  selectedValues,
}: MultiSelectDropdownProps) {
  return (
    <Command>
      {searchable && (
        <CommandInput
          aria-describedby={`${multiSelectId}-search-help`}
          aria-label="Search through available options"
          onKeyDown={handleInputKeyDown}
          onValueChange={onSearchValueChange}
          placeholder="Search options..."
          value={searchValue}
        />
      )}
      {searchable && (
        <div className="sr-only" id={`${multiSelectId}-search-help`}>
          Type to filter options. Use arrow keys to navigate results.
        </div>
      )}
      <CommandList
        className={cn(
          'max-h-[40vh] overflow-y-auto multiselect-scrollbar',
          screenSize === 'mobile' && 'max-h-[50vh]',
          'overscroll-behavior-y-contain',
        )}
      >
        <CommandEmpty>{emptyIndicator || <Text size={1}>No results found.</Text>}</CommandEmpty>{' '}
        {!hideSelectAll && !searchValue && (
          <CommandGroup>
            <div className="p-2">
              <Button
                mode="default"
                onClick={onToggleAll}
                size={1}
                text={
                  selectedValues.length === getAllOptions().filter((opt) => !opt.disabled).length
                    ? 'Deselect All'
                    : `Select All${getAllOptions().length > 20 ? ` (${getAllOptions().length} options)` : ''}`
                }
                tone="primary"
                width="fill"
              />
            </div>
          </CommandGroup>
        )}
        {isGroupedOptions(filteredOptions) ? (
          filteredOptions.map((group) => (
            <CommandGroup heading={group.heading} key={group.heading}>
              {group.options.map((option) => {
                const isSelected = selectedValues.includes(option.value)
                return (
                  <CommandItem
                    aria-disabled={option.disabled}
                    aria-label={`${option.label}${
                      isSelected ? ', selected' : ', not selected'
                    }${option.disabled ? ', disabled' : ''}`}
                    aria-selected={isSelected}
                    className={cn(
                      'cursor-pointer',
                      option.disabled && 'opacity-50 cursor-not-allowed',
                    )}
                    disabled={option.disabled}
                    key={option.value}
                    onSelect={() => onToggleOption(option.value)}
                    role="option"
                  >
                    <Checkbox checked={isSelected} className="pointer-events-none" readOnly />
                    {option.icon && (
                      <option.icon
                        aria-hidden="true"
                        className="mr-2 h-4 w-4 text-muted-foreground"
                      />
                    )}
                    <Text size={1}>{option.label}</Text>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ))
        ) : (
          <CommandGroup>
            {filteredOptions.map((option) => {
              const isSelected = selectedValues.includes(option.value)
              return (
                <CommandItem
                  aria-disabled={option.disabled}
                  aria-label={`${option.label}${
                    isSelected ? ', selected' : ', not selected'
                  }${option.disabled ? ', disabled' : ''}`}
                  aria-selected={isSelected}
                  className={cn(
                    'cursor-pointer',
                    option.disabled && 'opacity-50 cursor-not-allowed',
                  )}
                  disabled={option.disabled}
                  key={option.value}
                  onSelect={() => onToggleOption(option.value)}
                  role="option"
                >
                  <Checkbox checked={isSelected} className="pointer-events-none" readOnly />
                  {option.icon && (
                    <option.icon
                      aria-hidden="true"
                      className="mr-2 h-4 w-4 text-muted-foreground"
                    />
                  )}
                  <Text size={1}>{option.label}</Text>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  )
}
