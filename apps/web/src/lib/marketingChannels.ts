export const MARKETING_CHANNELS = [
  'EMAIL',
  'WHATSAPP',
  'SMS',
  'PHONE',
  'POST',
  'IN_PERSON',
  'OTHER',
] as const

export type MarketingChannelCode = (typeof MARKETING_CHANNELS)[number]

export function marketingChannelSummaryLabel(
  code: string | null | undefined,
  translate: (key: string) => string,
): string | null {
  const c = typeof code === 'string' ? code.trim() : ''
  if (!c) {
    return null
  }
  const upper = c.toUpperCase()
  if ((MARKETING_CHANNELS as readonly string[]).includes(upper)) {
    return translate(`crm.core.marketingChannelOption.${upper}`)
  }
  return c
}
