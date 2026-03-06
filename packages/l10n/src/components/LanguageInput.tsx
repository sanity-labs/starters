import {useId, useMemo} from 'react'
import {Autocomplete, Card, Flex, Spinner, Stack, Text} from '@sanity/ui'
import {EarthGlobeIcon} from '@sanity/icons'
import {
  DEFAULT_STUDIO_CLIENT_OPTIONS,
  set,
  useDocumentStore,
  usePerspective,
  useTranslation,
  type StringInputProps,
} from 'sanity'
import {useOpenTranslationsInspector} from '../translations/useOpenTranslationsInspector'
import {useObservable} from 'react-rx'
import {l10nLocaleNamespace} from '../i18n'
import {SUPPORTED_LANGUAGES_QUERY} from '../queries'
import {getFlagFromCode} from '../utils'

interface LocaleOption {
  value: string
  title: string
  flag: string
}

function filterOption(query: string, option: LocaleOption) {
  const q = query.toLowerCase()
  return option.title.toLowerCase().includes(q) || option.value.toLowerCase().includes(q)
}

function renderOption(option: LocaleOption) {
  return (
    <Card as="button" padding={2}>
      <Flex align="center" gap={2}>
        <Text size={2}>{option.flag || <EarthGlobeIcon />}</Text>
        <Stack space={2} flex={1}>
          <Text size={1} weight="medium">
            {option.title}
          </Text>
          <Text size={1} muted>
            {option.value}
          </Text>
        </Stack>
      </Flex>
    </Card>
  )
}

export function LanguageInput(props: StringInputProps) {
  const {
    value,
    onChange,
    elementProps: {onChange: _onChange, ...elementProps},
  } = props
  const {t} = useTranslation(l10nLocaleNamespace)
  const inputId = useId()
  const openTranslations = useOpenTranslationsInspector()

  const documentStore = useDocumentStore()
  const {perspectiveStack} = usePerspective()
  const languages$ = useMemo(
    () =>
      documentStore.listenQuery(
        SUPPORTED_LANGUAGES_QUERY,
        {},
        {...DEFAULT_STUDIO_CLIENT_OPTIONS, perspective: perspectiveStack},
      ),
    [documentStore, perspectiveStack],
  )
  const languages = useObservable(languages$)

  const options: LocaleOption[] = useMemo(
    () =>
      (languages ?? []).map((lang: {id: string; title: string}) => ({
        value: lang.id,
        title: lang.title,
        flag: getFlagFromCode(lang.id),
      })),
    [languages],
  )

  const resolvedLocale = useMemo(() => options.find((opt) => opt.value === value), [options, value])

  const handleSelect = (selectedValue: string) => {
    onChange(set(selectedValue))
  }

  // Loading state
  if (!languages) {
    return (
      <Card border padding={3} radius={2} tone="transparent">
        <Flex align="center" gap={3}>
          <Spinner muted />
          <Text size={1} muted>
            {t('language-input.loading')}
          </Text>
        </Flex>
      </Card>
    )
  }

  // Selected state — mirrors reference input card layout
  if (value) {
    const flag = resolvedLocale?.flag || getFlagFromCode(value)
    const title = resolvedLocale?.title || value

    return (
      <Card border radius={2} padding={1} tone="transparent">
        <Flex gap={1} align="center">
          <Card
            as="button"
            flex={1}
            radius={2}
            padding={2}
            tone="inherit"
            style={{cursor: 'pointer'}}
            onClick={openTranslations}
          >
            <Flex align="center" gap={2}>
              <Text size={2}>{flag || <EarthGlobeIcon />}</Text>
              <Stack space={2} flex={1}>
                <Text size={1} weight="medium">
                  {title}
                </Text>
                <Text size={1} muted>
                  {value}
                </Text>
              </Stack>
            </Flex>
          </Card>
        </Flex>
      </Card>
    )
  }

  // Empty state — Autocomplete picker
  return (
    <Autocomplete
      {...elementProps}
      id={inputId}
      options={options}
      placeholder={t('language-input.placeholder')}
      icon={EarthGlobeIcon}
      fontSize={1}
      padding={3}
      radius={2}
      openButton
      filterOption={filterOption}
      renderOption={renderOption}
      onSelect={handleSelect}
    />
  )
}
