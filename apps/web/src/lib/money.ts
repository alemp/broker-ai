export type MoneyFormatOptions = {
  locale: string
  currency: string
}

function safeNumber(value: string | number | null | undefined): number | null {
  if (value == null) {
    return null
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

export function getCurrencySymbol({ locale, currency }: MoneyFormatOptions): string {
  const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0)
  return parts.find((p) => p.type === 'currency')?.value ?? currency
}

export function formatCurrency(
  value: string | number | null | undefined,
  { locale, currency }: MoneyFormatOptions,
): string {
  const n = safeNumber(value)
  if (n == null) {
    return ''
  }
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n)
}

function getNumberSeparators(locale: string): { group: string; decimal: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6)
  const group = parts.find((p) => p.type === 'group')?.value ?? ','
  const decimal = parts.find((p) => p.type === 'decimal')?.value ?? '.'
  return { group, decimal }
}

function getFractionDigits(locale: string, currency: string): number {
  const opts = new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions()
  return typeof opts.maximumFractionDigits === 'number' ? opts.maximumFractionDigits : 2
}

export function parseCurrencyInput(
  input: string,
  { locale, currency }: MoneyFormatOptions,
): string {
  const { group, decimal } = getNumberSeparators(locale)
  const maxFrac = getFractionDigits(locale, currency)

  let s = input
    .replaceAll('\u00A0', ' ')
    .replace(/[^\d.,\- ]/g, '')
    .trim()

  // Remove spaces and grouping separators.
  s = s.replaceAll(' ', '').replaceAll(group, '')

  // Normalize decimal separator to "."
  if (decimal !== '.') {
    s = s.replaceAll(decimal, '.')
  }

  // Keep only one decimal separator.
  const firstDot = s.indexOf('.')
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replaceAll('.', '')
  }

  // Limit fraction digits.
  if (firstDot !== -1 && maxFrac >= 0) {
    const [intPart, fracPart = ''] = s.split('.', 2)
    s = `${intPart}.${fracPart.slice(0, maxFrac)}`
  }

  // Allow just "-" while typing.
  if (s === '-') {
    return s
  }

  // Strip leading zeros in integer part (keep "0" and "0.xxx").
  const neg = s.startsWith('-')
  const raw = neg ? s.slice(1) : s
  const [intPartRaw, frac = ''] = raw.split('.', 2)
  const intPart = intPartRaw.replace(/^0+(?=\d)/, '')
  return `${neg ? '-' : ''}${intPart}${raw.includes('.') ? `.${frac}` : ''}`
}

