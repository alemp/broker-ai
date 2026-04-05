/** Alinhado com `CampaignKind` na API (`apps/api/.../db/enums.py`). */
export const CAMPAIGN_KIND_VALUES = [
  'BIRTHDAY',
  'RENEWAL_REMINDER',
  'CROSS_SELL',
  'SEASONAL',
  'NEWSLETTER',
  'REENGAGEMENT',
  'CUSTOM',
] as const

export type CampaignKindValue = (typeof CAMPAIGN_KIND_VALUES)[number]
