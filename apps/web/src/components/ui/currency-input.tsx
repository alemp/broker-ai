import * as React from 'react'

import { cn } from '@/lib/utils'
import { getCurrencySymbol, parseCurrencyInput, type MoneyFormatOptions } from '@/lib/money'

import { Input } from './input'

export type CurrencyInputProps = Omit<
  React.ComponentProps<'input'>,
  'value' | 'onChange' | 'inputMode' | 'type'
> & {
  value: string
  onValueChange: (value: string) => void
  money: MoneyFormatOptions
  /** Applied to the wrapper <div>. */
  className?: string
  /** Applied to the underlying <input>. */
  inputClassName?: string
}

export function CurrencyInput({
  value,
  onValueChange,
  money,
  className,
  inputClassName,
  ...props
}: CurrencyInputProps) {
  const symbol = React.useMemo(() => getCurrencySymbol(money), [money])
  const [focused, setFocused] = React.useState(false)

  const displayValue = React.useMemo(() => {
    if (focused) {
      // While editing, show a plain number (no grouping/currency) to avoid caret jumps.
      return value
    }
    const n = value.trim() ? Number(value) : NaN
    if (!Number.isFinite(n)) {
      return ''
    }
    return new Intl.NumberFormat(money.locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: new Intl.NumberFormat(money.locale, {
        style: 'currency',
        currency: money.currency,
      }).resolvedOptions().maximumFractionDigits,
    }).format(n)
  }, [focused, money.currency, money.locale, value])

  const onChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    onValueChange(parseCurrencyInput(ev.target.value, money))
  }

  return (
    <div className={cn('relative', className)}>
      <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm">
        {symbol}
      </span>
      <Input
        {...props}
        className={cn('pl-9', inputClassName)}
        value={displayValue}
        onChange={onChange}
        onFocus={(e) => {
          setFocused(true)
          props.onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          props.onBlur?.(e)
        }}
        inputMode="decimal"
      />
    </div>
  )
}

