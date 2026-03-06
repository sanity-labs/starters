import {Card, Flex, Heading, Text} from '@sanity/ui'
import React from 'react'

export interface SummaryCardProps {
  icon: React.ComponentType
  label: string
  value: number | string
}

function SummaryCard({icon: CardIcon, label, value}: SummaryCardProps) {
  return (
    <Card border flex={1} padding={4} radius={4} tone="primary">
      <Flex className="h-full" direction="column" gap={5} justify="space-between">
        <Heading size={4}>{value}</Heading>
        <Flex align="center" gap={2}>
          <Text muted size={1}>
            <CardIcon />
          </Text>
          <Text size={3} weight="medium">
            {label}
          </Text>
        </Flex>
      </Flex>
    </Card>
  )
}

export default SummaryCard
