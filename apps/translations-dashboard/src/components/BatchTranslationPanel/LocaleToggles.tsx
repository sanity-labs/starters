import {Flex, Heading} from '@sanity/ui'

import {MultiSelect} from '#components/ui/multi-select'

import type {Language} from './types'

type LocaleTogglesProps = {
  allTargetLocales: Language[]
  disabled?: boolean
  onSelectLocales: (locales: string[]) => void
  selectedLocales: string[]
}

const LocaleToggles = ({
  allTargetLocales,
  disabled,
  onSelectLocales,
  selectedLocales,
}: LocaleTogglesProps) => {
  const options = allTargetLocales.map((locale) => ({
    label: locale.id,
    value: locale.id,
  }))

  return (
    <Flex align="center" gap={2}>
      <Heading as="h3" className="shrink-0" size={2} weight="medium">
        Locales:
      </Heading>

      <MultiSelect
        defaultValue={selectedLocales}
        disabled={disabled}
        maxCount={5}
        onValueChange={onSelectLocales}
        options={options}
        placeholder="Select target locales"
        searchable={true}
      />
    </Flex>
  )
}

export default LocaleToggles
