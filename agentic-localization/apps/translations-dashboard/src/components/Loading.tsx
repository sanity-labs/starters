import {Flex, Spinner} from '@sanity/ui'

const Loading = () => (
  <Flex align="center" className="w-screen" height="fill" justify="center">
    <Spinner />
  </Flex>
)

export default Loading
