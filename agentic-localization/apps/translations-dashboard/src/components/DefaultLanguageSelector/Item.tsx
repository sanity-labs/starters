import {Button} from '@sanity/ui'

import {useApp} from '../../contexts/AppContext'

const Item = (props: {id: string}) => {
  const {defaultLanguage, setDefaultLanguage} = useApp()

  return (
    <Button
      mode={defaultLanguage === props?.id ? 'default' : 'ghost'}
      onClick={() => setDefaultLanguage(props?.id)}
      text={props.id}
    />
  )
}

export default Item
