import * as React from 'react'

import type {MultiSelectGroup, MultiSelectOption} from '#components/ui/multi-select-types'

import {isGroupedOptions} from '#components/ui/multi-select-types'

interface UseMultiSelectOptions {
  closeOnSelect: boolean
  deduplicateOptions: boolean
  defaultValue: string[]
  disabled: boolean
  onValueChange: (value: string[]) => void
  options: MultiSelectGroup[] | MultiSelectOption[]
  resetOnDefaultValueChange: boolean
  searchable: boolean
}

export function useMultiSelect({
  closeOnSelect,
  deduplicateOptions,
  defaultValue,
  disabled,
  onValueChange,
  options,
  resetOnDefaultValueChange,
  searchable,
}: UseMultiSelectOptions) {
  const [selectedValues, setSelectedValues] = React.useState<string[]>(defaultValue)
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState('')
  const prevDefaultValueRef = React.useRef<string[]>(defaultValue)

  const arraysEqual = React.useCallback((a: string[], b: string[]): boolean => {
    if (a.length !== b.length) return false
    const sortedA = [...a].sort()
    const sortedB = [...b].sort()
    return sortedA.every((val, index) => val === sortedB[index])
  }, [])

  const getAllOptions = React.useCallback((): MultiSelectOption[] => {
    if (options.length === 0) return []
    let allOptions: MultiSelectOption[]
    if (isGroupedOptions(options)) {
      allOptions = options.flatMap((group) => group.options)
    } else {
      allOptions = options
    }
    const valueSet = new Set<string>()
    const duplicates: string[] = []
    const uniqueOptions: MultiSelectOption[] = []
    allOptions.forEach((option) => {
      if (valueSet.has(option.value)) {
        duplicates.push(option.value)
        if (!deduplicateOptions) uniqueOptions.push(option)
      } else {
        valueSet.add(option.value)
        uniqueOptions.push(option)
      }
    })
    if (process.env.NODE_ENV === 'development' && duplicates.length > 0) {
      const action = deduplicateOptions ? 'automatically removed' : 'detected'
      console.warn(
        `MultiSelect: Duplicate option values ${action}: ${duplicates.join(', ')}. ` +
          `${deduplicateOptions ? 'Duplicates have been removed automatically.' : "This may cause unexpected behavior. Consider setting 'deduplicateOptions={true}' or ensure all option values are unique."}`,
      )
    }
    return deduplicateOptions ? uniqueOptions : allOptions
  }, [options, deduplicateOptions])

  const getOptionByValue = React.useCallback(
    (value: string): MultiSelectOption | undefined => {
      const option = getAllOptions().find((o) => o.value === value)
      if (!option && process.env.NODE_ENV === 'development') {
        console.warn(`MultiSelect: Option with value "${value}" not found in options list`)
      }
      return option
    },
    [getAllOptions],
  )

  const filteredOptions = React.useMemo(() => {
    if (!searchable || !searchValue) return options
    if (options.length === 0) return []
    if (isGroupedOptions(options)) {
      return options
        .map((group) => ({
          ...group,
          options: group.options.filter(
            (o) =>
              o.label.toLowerCase().includes(searchValue.toLowerCase()) ||
              o.value.toLowerCase().includes(searchValue.toLowerCase()),
          ),
        }))
        .filter((group) => group.options.length > 0)
    }
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(searchValue.toLowerCase()) ||
        o.value.toLowerCase().includes(searchValue.toLowerCase()),
    )
  }, [options, searchValue, searchable])

  const toggleOption = React.useCallback(
    (optionValue: string) => {
      if (disabled) return
      const option = getOptionByValue(optionValue)
      if (option?.disabled) return
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter((v) => v !== optionValue)
        : [...selectedValues, optionValue]
      setSelectedValues(newValues)
      onValueChange(newValues)
      if (closeOnSelect) setIsPopoverOpen(false)
    },
    [disabled, getOptionByValue, selectedValues, onValueChange, closeOnSelect],
  )

  const toggleAll = React.useCallback(() => {
    if (disabled) return
    const all = getAllOptions().filter((o) => !o.disabled)
    if (selectedValues.length === all.length) {
      setSelectedValues([])
      onValueChange([])
    } else {
      const allValues = all.map((o) => o.value)
      setSelectedValues(allValues)
      onValueChange(allValues)
    }
    if (closeOnSelect) setIsPopoverOpen(false)
  }, [disabled, getAllOptions, selectedValues, onValueChange, closeOnSelect])

  const handleInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        setIsPopoverOpen(true)
      } else if (event.key === 'Backspace' && !event.currentTarget.value) {
        const newValues = [...selectedValues]
        newValues.pop()
        setSelectedValues(newValues)
        onValueChange(newValues)
      }
    },
    [selectedValues, onValueChange],
  )

  const resetToDefault = React.useCallback(() => {
    setSelectedValues(defaultValue)
    setIsPopoverOpen(false)
    setSearchValue('')
    onValueChange(defaultValue)
  }, [defaultValue, onValueChange])

  React.useEffect(() => {
    if (!resetOnDefaultValueChange) return
    const prev = prevDefaultValueRef.current
    if (!arraysEqual(prev, defaultValue)) {
      if (!arraysEqual(selectedValues, defaultValue)) setSelectedValues(defaultValue)
      prevDefaultValueRef.current = [...defaultValue]
    }
  }, [defaultValue, selectedValues, arraysEqual, resetOnDefaultValueChange])

  React.useEffect(() => {
    if (!isPopoverOpen) setSearchValue('')
  }, [isPopoverOpen])

  return {
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
  }
}
