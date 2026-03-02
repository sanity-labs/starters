import {useEffect, useMemo, useRef, useState, useTransition} from 'react'
import styled from 'styled-components'
import {Box, Button, Card, Flex, Popover, Stack, Text} from '@sanity/ui'
import {CheckmarkIcon, ChevronDownIcon, EarthGlobeIcon} from '@sanity/icons'
import {
  DEFAULT_STUDIO_CLIENT_OPTIONS,
  useDocumentStore,
  useTranslation,
  type NavbarProps,
} from 'sanity'
import {useObservable} from 'react-rx'
import {l10nLocaleNamespace} from '../i18n'
import {globalLocaleFilter$} from '../localeFilterState'
import {useLocaleFilter} from '../useLocaleFilter'
import {SUPPORTED_LANGUAGES_QUERY} from '../queries'
import {getFlagFromCode} from '../utils'
import type {Observable} from 'rxjs'

/** Calls `handler` on Enter or Space, preventing default. Used for `role="option"` activation. */
function activateOnKeyDown(handler: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handler()
    }
  }
}

const renderLocaleButton = () => <LocaleSwitcherButton />

export function LocaleNavbar(props: NavbarProps) {
  const actions: NavbarProps['__internal_actions'] = [
    ...(props.__internal_actions ?? []),
    {location: 'topbar', name: 'locale-switcher', render: renderLocaleButton},
  ]

  return props.renderDefault({...props, __internal_actions: actions})
}

function LocaleSwitcherButton() {
  const {t} = useTranslation(l10nLocaleNamespace)
  const documentStore = useDocumentStore()
  const languages$ = useMemo(
    () =>
      documentStore.listenQuery(
        SUPPORTED_LANGUAGES_QUERY,
        {},
        {...DEFAULT_STUDIO_CLIENT_OPTIONS, perspective: 'published'},
      ),
    [documentStore],
  )
  const languages = useObservable<Observable<{id: string; title: string}[]>>(languages$)

  const [selectedLocales] = useLocaleFilter()
  const hasFilter = selectedLocales.length > 0
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const toggle = () => setOpen((prev) => !prev)

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return

    const {signal, abort} = new AbortController()

    document.addEventListener(
      'mousedown',
      (e) => {
        const target = e.target as Node
        if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) return
        setOpen(false)
      },
      {signal},
    )

    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') setOpen(false)
      },
      {signal},
    )

    return () => abort()
  }, [open])

  if (!languages) {
    return (
      <Button
        aria-label={t('locale-filter.loading')}
        icon={EarthGlobeIcon}
        iconRight={ChevronDownIcon}
        mode="bleed"
        radius="full"
        fontSize={1}
        padding={2}
        paddingRight={3}
        space={2}
        text={`\u2009\u2014\u2009`}
        disabled
      />
    )
  }

  const buttonLabel = hasFilter
    ? t('locale-filter.button-label.filtered', {
        count: selectedLocales.length,
        total: languages.length,
      })
    : t('locale-filter.button-label.all', {total: languages.length})

  const ariaLabel = hasFilter
    ? t('locale-filter.aria-label.filtered', {
        count: selectedLocales.length,
        total: languages.length,
      })
    : t('locale-filter.aria-label.all', {total: languages.length})

  return (
    <Popover
      open={open}
      portal
      constrainSize
      placement="bottom-end"
      tone="default"
      ref={popoverRef}
      content={
        <Card radius={2} shadow={2}>
          <LocaleDropdownContent languages={languages} selectedLocales={selectedLocales} />
        </Card>
      }
    >
      <Button
        ref={buttonRef}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        icon={EarthGlobeIcon}
        iconRight={ChevronDownIcon}
        mode="bleed"
        radius="full"
        fontSize={1}
        padding={2}
        paddingRight={3}
        space={2}
        text={buttonLabel}
        tone={hasFilter ? 'primary' : 'default'}
        selected={hasFilter || open}
        onClick={toggle}
      />
    </Popover>
  )
}

function LocaleDropdownContent({
  languages,
  selectedLocales,
}: {
  languages: {id: string; title: string}[]
  selectedLocales: string[]
}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const [, startTransition] = useTransition()
  const containerRef = useRef<HTMLDivElement>(null)

  // Focus the first option when the dropdown mounts (popover opens)
  useEffect(() => {
    containerRef.current?.querySelector<HTMLElement>('[role="option"]')?.focus()
  }, [])

  const checkedSet = new Set(
    selectedLocales.length === 0 ? languages.map((l) => l.id) : selectedLocales,
  )
  const allChecked = checkedSet.size === languages.length && selectedLocales.length === 0

  function setFilter(locales: string[]) {
    startTransition(() => {
      globalLocaleFilter$.next(locales)
    })
  }

  function handleToggle(id: string) {
    const next = new Set(checkedSet)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    const allSelected = next.size === languages.length
    setFilter(allSelected ? [] : Array.from(next))
  }

  function handleAll() {
    setFilter([])
  }

  function handleListboxKeyDown(e: React.KeyboardEvent) {
    const options = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
      '[role="option"]',
    )
    const active = document.activeElement as HTMLElement | null
    const index = active ? Array.from(options).indexOf(active) : -1

    let next: HTMLElement | undefined
    if (e.key === 'ArrowDown') next = options[index + 1] ?? options[0]
    else if (e.key === 'ArrowUp') next = options[index - 1] ?? options[options.length - 1]
    else if (e.key === 'Home') next = options[0]
    else if (e.key === 'End') next = options[options.length - 1]
    else return

    e.preventDefault()
    next?.focus()
  }

  return (
    <DropdownContainer
      ref={containerRef}
      role="listbox"
      aria-multiselectable="true"
      onKeyDown={handleListboxKeyDown}
    >
      <Stack space={1} padding={1}>
        <DropdownRow
          role="option"
          aria-selected={allChecked}
          tabIndex={0}
          onClick={handleAll}
          onKeyDown={activateOnKeyDown(handleAll)}
        >
          <Flex align="center" gap={3} padding={2} paddingRight={3}>
            <Text size={1} aria-hidden>
              <EarthGlobeIcon />
            </Text>
            <Box flex={1}>
              <Text size={1} weight="medium">
                {t('locale-filter.show-all')}
              </Text>
            </Box>
            <RightSlot>
              <CheckmarkWrapper aria-hidden>{allChecked && <CheckmarkIcon />}</CheckmarkWrapper>
            </RightSlot>
          </Flex>
        </DropdownRow>
        <Divider />
        {languages.map((lang) => {
          const isChecked = checkedSet.has(lang.id)
          return (
            <LocaleRow
              key={lang.id}
              lang={lang}
              checked={isChecked}
              onToggle={() => handleToggle(lang.id)}
              onOnly={() => setFilter([lang.id])}
            />
          )
        })}
      </Stack>
    </DropdownContainer>
  )
}

const DropdownContainer = styled.div`
  min-width: 200px;
  touch-action: manipulation;
`

const Divider = styled.hr`
  border: none;
  border-top: 1px solid var(--card-border-color);
  margin: 0;
`

const OnlyButtonWrapper = styled.span`
  visibility: hidden;
`

const CheckmarkWrapper = styled.span`
  display: flex;
`

const DropdownRow = styled.div`
  border-radius: 3px;
  cursor: pointer;
  outline: none;

  &:hover,
  &:focus-visible {
    background: var(--card-bg2-color, var(--card-code-bg-color));
  }

  &:focus-visible {
    box-shadow: inset 0 0 0 1px var(--card-focus-ring-color);
  }

  &:hover ${OnlyButtonWrapper}, &:focus-within ${OnlyButtonWrapper} {
    visibility: visible;
  }

  &:hover ${CheckmarkWrapper}, &:focus-within ${CheckmarkWrapper} {
    visibility: hidden;
  }
`

function LocaleRow({
  lang,
  checked,
  onToggle,
  onOnly,
}: {
  lang: {id: string; title: string}
  checked: boolean
  onToggle: () => void
  onOnly: () => void
}) {
  const {t} = useTranslation(l10nLocaleNamespace)
  const flag = getFlagFromCode(lang.id)

  return (
    <DropdownRow
      role="option"
      aria-selected={checked}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={activateOnKeyDown(onToggle)}
    >
      <Flex align="center" gap={3} padding={2} paddingRight={3}>
        <Box flex={1}>
          <Text size={1} weight="medium">
            <span aria-hidden>{flag} </span>
            {lang.title}
          </Text>
        </Box>
        <RightSlot>
          <CheckmarkWrapper aria-hidden>{checked && <CheckmarkIcon />}</CheckmarkWrapper>
          <OnlyButtonWrapper>
            <Button
              as="span"
              role="button"
              tabIndex={0}
              aria-label={t('locale-filter.only-aria-label', {
                title: lang.title,
              })}
              text={t('locale-filter.only')}
              mode="ghost"
              tone="primary"
              fontSize={0}
              padding={1}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                e.stopPropagation()
                onOnly()
              }}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  onOnly()
                }
              }}
            />
          </OnlyButtonWrapper>
        </RightSlot>
      </Flex>
    </DropdownRow>
  )
}

const RightSlot = styled.span`
  display: grid;
  place-items: center;

  & > * {
    grid-area: 1 / 1;
  }
`
