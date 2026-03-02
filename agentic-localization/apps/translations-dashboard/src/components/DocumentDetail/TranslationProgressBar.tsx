import {Card, Flex, Text} from '@sanity/ui'
import {motion} from 'framer-motion'

type TranslationProgressBarProps = {
  languageId: string
  progress: number
}

const TranslationProgressBar = ({languageId, progress}: TranslationProgressBarProps) => {
  return (
    <Card
      border
      className="border-2 border-gray-300 overflow-hidden min-h-[3.25rem] relative"
      padding={0}
      radius={3}
      tone="default"
    >
      {/* Animated progress bar background */}
      <motion.div
        animate={{width: `${progress}%`}}
        className="absolute inset-0 bg-gray-400 z-0"
        initial={{width: '0%'}}
        transition={{
          duration: 0.6,
          ease: 'easeInOut',
        }}
      />

      {/* Content overlay */}
      <div className="relative z-10 p-3">
        <Flex align="center" gap={2} wrap="wrap">
          <div className="cursor-pointer transition-all duration-200 px-2 py-1 text-white text-xs rounded-full w-14 flex-shrink-0 text-center bg-gray-600">
            {languageId}
          </div>
          <Text size={1} weight="semibold">
            Translating...
          </Text>
        </Flex>
      </div>
    </Card>
  )
}

export default TranslationProgressBar
