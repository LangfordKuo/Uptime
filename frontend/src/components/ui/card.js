import { h } from 'vue'

// Card 家族：与 shadcn/ui 相同的类名结构
export const Card = (props, { slots }) =>
  h('div', { class: 'bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm' }, slots)

export const CardHeader = (props, { slots }) =>
  h('div', { class: '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto]' }, slots)

export const CardTitle = (props, { slots }) =>
  h('div', { class: 'leading-none font-semibold' }, slots)

export const CardDescription = (props, { slots }) =>
  h('div', { class: 'text-muted-foreground text-sm' }, slots)

export const CardAction = (props, { slots }) =>
  h('div', { class: 'col-start-2 row-span-2 row-start-1 self-start justify-self-end', 'data-slot': 'card-action' }, slots)

export const CardContent = (props, { slots }) =>
  h('div', { class: 'px-6' }, slots)

export const CardFooter = (props, { slots }) =>
  h('div', { class: 'flex items-center px-6 [.border-t]:pt-6' }, slots)

export default Card
