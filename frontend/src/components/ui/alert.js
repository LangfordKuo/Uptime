import { h } from 'vue'
import { cn } from '@/lib/utils'

const variants = {
  default: 'text-card-foreground [&>svg]:text-card-foreground',
  destructive: 'text-destructive [&>svg]:text-current',
  success: 'text-success [&>svg]:text-current border-success/30 bg-success/5',
  warning: 'text-warning [&>svg]:text-current border-warning/30 bg-warning/5 dark:text-warning',
  info: 'text-primary [&>svg]:text-current border-primary/30 bg-primary/5'
}

export const Alert = (props, { slots, attrs }) =>
  h(
    'div',
    {
      class: cn(
        'relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5',
        variants[props.variant || 'default'],
        attrs.class
      ),
      role: 'alert'
    },
    slots.default?.()
  )

Alert.props = ['variant']

export const AlertTitle = (props, { slots }) =>
  h('div', { class: 'col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight' }, slots)

export const AlertDescription = (props, { slots }) =>
  h('div', { class: 'text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed' }, slots)

export default Alert
