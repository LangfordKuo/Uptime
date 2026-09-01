import { h } from 'vue'

// Table 家族：shadcn 表格类名
export const Table = (props, { slots }) =>
  h('div', { class: 'relative w-full overflow-x-auto' }, [
    h('table', { class: 'w-full caption-bottom text-sm' }, slots.default?.())
  ])

export const TableHeader = (props, { slots }) =>
  h('thead', { class: '[&_tr]:border-b' }, slots)

export const TableBody = (props, { slots }) =>
  h('tbody', { class: '[&_tr:last-child]:border-0' }, slots)

export const TableRow = (props, { slots }) =>
  h('tr', {
    class: 'hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors'
  }, slots)

export const TableHead = (props, { slots }) =>
  h('th', {
    class: 'text-foreground h-10 px-3 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0'
  }, slots)

export const TableCell = (props, { slots }) =>
  h('td', {
    class: 'p-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0'
  }, slots)

export default Table
