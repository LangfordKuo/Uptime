import { h } from 'vue'
import { cn } from '@/lib/utils'

export const Separator = (props, { attrs }) =>
  h('div', {
    class: cn(
      'bg-border shrink-0',
      props.orientation === 'vertical' ? 'w-px h-full self-stretch' : 'h-px w-full',
      attrs.class
    ),
    role: 'separator'
  })

Separator.props = ['orientation']

export default Separator
