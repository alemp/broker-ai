import type { TFunction } from 'i18next'

type CommonT = TFunction<'common'>

export function translateLeadStatus(status: string, t: CommonT): string {
  return t(`crm.enum.leadStatus.${status}`, { defaultValue: status })
}

export function translateOpportunityStage(stage: string, t: CommonT): string {
  return t(`crm.enum.opportunityStage.${stage}`, { defaultValue: stage })
}

export function translateOpportunityStatus(status: string, t: CommonT): string {
  return t(`crm.enum.opportunityStatus.${status}`, { defaultValue: status })
}

export function translateInteractionType(type: string, t: CommonT): string {
  return t(`crm.enum.interactionType.${type}`, { defaultValue: type })
}

export function translateIngestionSource(source: string, t: CommonT): string {
  return t(`crm.enum.ingestionSource.${source}`, { defaultValue: source })
}

export function translateProductCategory(category: string, t: CommonT): string {
  return t(`crm.enum.productCategory.${category}`, { defaultValue: category })
}

export function translateCampaignKind(kind: string, t: CommonT): string {
  return t(`crm.enum.campaignKind.${kind}`, { defaultValue: kind })
}
