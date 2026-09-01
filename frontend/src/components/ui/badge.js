import { h } from 'vue'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const variants = {
  default: 'border-transparent bg-primary text-primary-foreground',
  secondary: 'border-transparent bg-secondary text-secondary-foreground',
  destructive: 'border-transparent bg-destructive text-destructive-foreground',
  outline: 'text-foreground',
  success: 'border-transparent bg-success/10 text-success border-success/20',
  warning: 'border-transparent bg-warning/15 text-warning border-warning/25 dark:text-warning',
  info: 'border-transparent bg-primary/10 text-primary border-primary/20'
}

export const Badge = (props, { slots, attrs }) =>
  h(
    'span',
    {
      class: cn(
        'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none',
        variants[props.variant || 'default'],
        attrs.class
      )
    },
    slots.default?.()
  )

Badge.props = ['variant']

export default Badge

export const badgeVariants = cva('', { variants: { variant: variants } })
