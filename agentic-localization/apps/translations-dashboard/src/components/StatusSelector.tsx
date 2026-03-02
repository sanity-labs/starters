import {Button, Grid} from '@sanity/ui'
import {startTransition} from 'react'

import {useApp} from '../contexts/AppContext'

const STATUSES = ['all', 'untranslated', 'partially-translated', 'fully-translated'] as const

const statusText = {
  all: 'All',
  'fully-translated': 'Fully Translated',
  'partially-translated': 'Partially Translated',
  untranslated: 'Untranslated',
}

const StatusSelector = () => {
  const {setStatus, status} = useApp()

  const handleStatusChange = (newStatus: (typeof STATUSES)[number]) => {
    startTransition(() => {
      setStatus(newStatus)
    })
  }

  return (
    <Grid columns={[2, 2, 2, 4]} gap={1}>
      {STATUSES.map((statusOption) => (
        <Button
          key={statusOption}
          mode={statusOption === status ? 'default' : 'ghost'}
          onClick={() => handleStatusChange(statusOption)}
          text={statusText[statusOption]}
        />
      ))}
    </Grid>
  )
}

export default StatusSelector
