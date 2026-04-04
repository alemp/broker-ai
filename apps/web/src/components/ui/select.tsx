import { Check, ChevronDown } from 'lucide-react'
import * as React from 'react'
import { Select } from 'radix-ui'

import { cn } from '@/lib/utils'

/** Radix Select disallows ""; map empty to this value when allowEmpty is true. */
export const SELECT_EMPTY_VALUE = '__empty__'

export type FormSelectOption = { value: string; label: string }

function dedupeOptions(opts: FormSelectOption[]): FormSelectOption[] {
  const seen = new Set<string>()
  const out: FormSelectOption[] = []
  for (const o of opts) {
    if (seen.has(o.value)) {
      continue
    }
    seen.add(o.value)
    out.push(o)
  }
  return out
}

const triggerStyles = cn(
  'border-input bg-background flex h-8 w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1 text-sm outline-none transition-colors',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
  'dark:bg-input/30',
  '[&>span]:line-clamp-1',
)

const contentStyles = cn(
  'bg-popover text-popover-foreground relative z-50 max-h-96 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border shadow-md',
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
)

const itemStyles = cn(
  'focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none',
  'data-disabled:pointer-events-none data-disabled:opacity-50',
)

export type FormSelectProps = {
  id?: string
  value: string
  onValueChange: (value: string) => void
  options: readonly FormSelectOption[]
  /** When true, first row maps "" ↔ SELECT_EMPTY_VALUE. */
  allowEmpty?: boolean
  emptyLabel?: string
  /** Prepended after the empty row (e.g. API value not in catalog). */
  extraOptions?: readonly FormSelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function FormSelect({
  id,
  value,
  onValueChange,
  options,
  allowEmpty = false,
  emptyLabel,
  extraOptions,
  placeholder,
  disabled,
  className,
}: FormSelectProps) {
  const mergedOptions = React.useMemo(() => {
    const parts: FormSelectOption[] = []
    if (allowEmpty) {
      parts.push({
        value: SELECT_EMPTY_VALUE,
        label: emptyLabel ?? placeholder ?? '—',
      })
    }
    if (extraOptions?.length) {
      parts.push(...extraOptions)
    }
    parts.push(...options)
    return dedupeOptions(parts)
  }, [allowEmpty, emptyLabel, extraOptions, options, placeholder])

  const rootValue = allowEmpty && value === '' ? SELECT_EMPTY_VALUE : value

  const handleChange = (v: string) => {
    onValueChange(v === SELECT_EMPTY_VALUE ? '' : v)
  }

  return (
    <Select.Root value={rootValue} onValueChange={handleChange} disabled={disabled}>
      <Select.Trigger id={id} className={cn(triggerStyles, className)}>
        <Select.Value placeholder={placeholder} />
        <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className={contentStyles} position="popper" sideOffset={4}>
          <Select.Viewport className="p-1">
            {mergedOptions.map((opt) => (
              <Select.Item key={opt.value} value={opt.value} className={itemStyles}>
                <span className="absolute left-2 flex size-3.5 items-center justify-center">
                  <Select.ItemIndicator>
                    <Check className="size-4" />
                  </Select.ItemIndicator>
                </span>
                <Select.ItemText>{opt.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
