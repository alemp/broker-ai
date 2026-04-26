import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormSelect, SELECT_EMPTY_VALUE } from '@/components/ui/select'

export type InsurerOption = { id: string; name: string }

export type CoverageRow = { title: string; detail: string }

export type MaterialRow = { label: string; url: string }

export type ProductCatalogDraft = {
  name: string
  product_line: string
  category: string
  description: string
  risk_level: string
  target_tags: string
  active: boolean
  insurer_id: string
  main_coverage_summary: string
  exclusions_notes: string
  recommended_profile_summary: string
  commercial_arguments: string
  additional_coverages: CoverageRow[]
  support_materials: MaterialRow[]
}

export function emptyProductCatalogDraft(): ProductCatalogDraft {
  return {
    name: '',
    product_line: '',
    category: 'AUTO_INSURANCE',
    description: '',
    risk_level: 'MEDIUM',
    target_tags: '',
    active: true,
    insurer_id: '',
    main_coverage_summary: '',
    exclusions_notes: '',
    recommended_profile_summary: '',
    commercial_arguments: '',
    additional_coverages: [],
    support_materials: [],
  }
}

const textareaClass =
  'border-input bg-background min-h-[88px] w-full rounded-md border px-3 py-2 text-sm'

type Props = {
  draft: ProductCatalogDraft
  setDraft: Dispatch<SetStateAction<ProductCatalogDraft>>
  insurers: InsurerOption[]
}

export function ProductCatalogEditorBody({ draft, setDraft, insurers }: Props) {
  const { t } = useTranslation('common')
  const [touchedName, setTouchedName] = useState(false)

  const nameError =
    (touchedName || draft.name !== '') && !draft.name.trim() ? t('crm.validation.required') : null

  const categoryOptions = [
    { value: 'AUTO_INSURANCE', label: t('crm.catalog.category.AUTO_INSURANCE') },
    { value: 'GENERAL_INSURANCE', label: t('crm.catalog.category.GENERAL_INSURANCE') },
    { value: 'LIFE_INSURANCE', label: t('crm.catalog.category.LIFE_INSURANCE') },
    { value: 'HEALTH_INSURANCE', label: t('crm.catalog.category.HEALTH_INSURANCE') },
  ]

  const riskOptions = [
    { value: 'LOW', label: t('crm.catalog.risk.LOW') },
    { value: 'MEDIUM', label: t('crm.catalog.risk.MEDIUM') },
    { value: 'HIGH', label: t('crm.catalog.risk.HIGH') },
  ]

  const insurerSelectOptions = insurers.map((i) => ({ value: i.id, label: i.name }))

  const addCoverage = () => {
    setDraft((d) => ({
      ...d,
      additional_coverages: [...d.additional_coverages, { title: '', detail: '' }],
    }))
  }

  const removeCoverage = (idx: number) => {
    setDraft((d) => ({
      ...d,
      additional_coverages: d.additional_coverages.filter((_, i) => i !== idx),
    }))
  }

  const addMaterial = () => {
    setDraft((d) => ({
      ...d,
      support_materials: [...d.support_materials, { label: '', url: '' }],
    }))
  }

  const removeMaterial = (idx: number) => {
    setDraft((d) => ({
      ...d,
      support_materials: d.support_materials.filter((_, i) => i !== idx),
    }))
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="pc-name">{t('crm.catalog.fields.name')}</Label>
          <Input
            id="pc-name"
            value={draft.name}
            onChange={(ev) => setDraft((d) => ({ ...d, name: ev.target.value }))}
            required
              onBlur={() => setTouchedName(true)}
              aria-invalid={nameError ? true : undefined}
          />
            {nameError ? <p className="text-destructive text-xs">{nameError}</p> : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pc-line">{t('crm.catalog.fields.productLine')}</Label>
          <Input
            id="pc-line"
            value={draft.product_line}
            onChange={(ev) => setDraft((d) => ({ ...d, product_line: ev.target.value }))}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pc-cat">{t('crm.catalog.fields.category')}</Label>
          <FormSelect
            id="pc-cat"
            value={draft.category}
            onValueChange={(v) => setDraft((d) => ({ ...d, category: v }))}
            options={categoryOptions}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pc-risk">{t('crm.catalog.fields.riskLevel')}</Label>
          <FormSelect
            id="pc-risk"
            value={draft.risk_level}
            onValueChange={(v) => setDraft((d) => ({ ...d, risk_level: v }))}
            options={riskOptions}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pc-ins">{t('crm.catalog.fields.insurer')}</Label>
          <FormSelect
            id="pc-ins"
            value={draft.insurer_id || SELECT_EMPTY_VALUE}
            onValueChange={(v) =>
              setDraft((d) => ({
                ...d,
                insurer_id: v === SELECT_EMPTY_VALUE ? '' : v,
              }))
            }
            options={insurerSelectOptions}
            allowEmpty
            emptyLabel={t('crm.catalog.fields.insurerNone')}
          />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input
            id="pc-active"
            type="checkbox"
            className="border-input size-4 rounded border"
            checked={draft.active}
            onChange={(ev) => setDraft((d) => ({ ...d, active: ev.target.checked }))}
          />
          <Label htmlFor="pc-active" className="font-normal">
            {t('crm.catalog.fields.active')}
          </Label>
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="pc-tags">{t('crm.catalog.fields.targetTags')}</Label>
          <Input
            id="pc-tags"
            value={draft.target_tags}
            onChange={(ev) => setDraft((d) => ({ ...d, target_tags: ev.target.value }))}
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="pc-desc">{t('crm.catalog.fields.description')}</Label>
          <textarea
            id="pc-desc"
            className={textareaClass}
            value={draft.description}
            onChange={(ev) => setDraft((d) => ({ ...d, description: ev.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">{t('crm.catalog.section.coverages')}</h3>
        <div className="grid gap-2">
          <Label htmlFor="pc-main">{t('crm.catalog.fields.mainCoverage')}</Label>
          <textarea
            id="pc-main"
            className={textareaClass}
            value={draft.main_coverage_summary}
            onChange={(ev) => setDraft((d) => ({ ...d, main_coverage_summary: ev.target.value }))}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pc-exc">{t('crm.catalog.fields.exclusions')}</Label>
          <textarea
            id="pc-exc"
            className={textareaClass}
            value={draft.exclusions_notes}
            onChange={(ev) => setDraft((d) => ({ ...d, exclusions_notes: ev.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>{t('crm.catalog.fields.additionalCoverages')}</Label>
            <button
              type="button"
              className="text-primary text-sm underline"
              onClick={addCoverage}
            >
              {t('crm.catalog.action.addRow')}
            </button>
          </div>
          {draft.additional_coverages.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('crm.catalog.hints.noExtraCoverages')}</p>
          ) : (
            <ul className="space-y-3">
              {draft.additional_coverages.map((row, idx) => (
                <li
                  key={idx}
                  className="border-border/80 flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-start"
                >
                  <div className="grid min-w-0 flex-1 gap-2">
                    <Label className="sr-only">{t('crm.catalog.fields.coverageTitle')}</Label>
                    <Input
                      placeholder={t('crm.catalog.fields.coverageTitle')}
                      value={row.title}
                      onChange={(ev) => {
                        const v = ev.target.value
                        setDraft((d) => ({
                          ...d,
                          additional_coverages: d.additional_coverages.map((r, i) =>
                            i === idx ? { ...r, title: v } : r,
                          ),
                        }))
                      }}
                    />
                    <textarea
                      className={textareaClass}
                      placeholder={t('crm.catalog.fields.coverageDetail')}
                      value={row.detail}
                      onChange={(ev) => {
                        const v = ev.target.value
                        setDraft((d) => ({
                          ...d,
                          additional_coverages: d.additional_coverages.map((r, i) =>
                            i === idx ? { ...r, detail: v } : r,
                          ),
                        }))
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="text-destructive shrink-0 text-sm"
                    onClick={() => removeCoverage(idx)}
                  >
                    {t('crm.catalog.action.removeRow')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">{t('crm.catalog.section.commercial')}</h3>
        <div className="grid gap-2">
          <Label htmlFor="pc-prof">{t('crm.catalog.fields.recommendedProfile')}</Label>
          <textarea
            id="pc-prof"
            className={textareaClass}
            value={draft.recommended_profile_summary}
            onChange={(ev) =>
              setDraft((d) => ({ ...d, recommended_profile_summary: ev.target.value }))
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pc-args">{t('crm.catalog.fields.commercialArguments')}</Label>
          <textarea
            id="pc-args"
            className={textareaClass}
            value={draft.commercial_arguments}
            onChange={(ev) => setDraft((d) => ({ ...d, commercial_arguments: ev.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>{t('crm.catalog.fields.supportMaterials')}</Label>
          <button type="button" className="text-primary text-sm underline" onClick={addMaterial}>
            {t('crm.catalog.action.addRow')}
          </button>
        </div>
        {draft.support_materials.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('crm.catalog.hints.noMaterials')}</p>
        ) : (
          <ul className="space-y-3">
            {draft.support_materials.map((row, idx) => (
              <li
                key={idx}
                className="border-border/80 flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-end"
              >
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className="sr-only">{t('crm.catalog.fields.materialLabel')}</Label>
                    <Input
                      placeholder={t('crm.catalog.fields.materialLabel')}
                      value={row.label}
                      onChange={(ev) => {
                        const v = ev.target.value
                        setDraft((d) => ({
                          ...d,
                          support_materials: d.support_materials.map((r, i) =>
                            i === idx ? { ...r, label: v } : r,
                          ),
                        }))
                      }}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="sr-only">{t('crm.catalog.fields.materialUrl')}</Label>
                    <Input
                      placeholder={t('crm.catalog.fields.materialUrl')}
                      value={row.url}
                      onChange={(ev) => {
                        const v = ev.target.value
                        setDraft((d) => ({
                          ...d,
                          support_materials: d.support_materials.map((r, i) =>
                            i === idx ? { ...r, url: v } : r,
                          ),
                        }))
                      }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="text-destructive shrink-0 text-sm"
                  onClick={() => removeMaterial(idx)}
                >
                  {t('crm.catalog.action.removeRow')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function nullableTrim(s: string): string | null {
  const t = s.trim()
  return t === '' ? null : t
}

export function buildProductJsonBody(draft: ProductCatalogDraft): Record<string, unknown> {
  const additional = draft.additional_coverages
    .filter((r) => r.title.trim() || r.detail.trim())
    .map((r) => ({ title: r.title.trim(), detail: r.detail.trim() }))
  const materials = draft.support_materials
    .filter((r) => r.label.trim() || r.url.trim())
    .map((r) => ({ label: r.label.trim(), url: r.url.trim() }))
  return {
    name: draft.name.trim(),
    product_line: nullableTrim(draft.product_line),
    category: draft.category,
    description: nullableTrim(draft.description),
    risk_level: draft.risk_level,
    target_tags: nullableTrim(draft.target_tags),
    active: draft.active,
    insurer_id: draft.insurer_id.trim() === '' ? null : draft.insurer_id.trim(),
    main_coverage_summary: nullableTrim(draft.main_coverage_summary),
    additional_coverages: additional,
    exclusions_notes: nullableTrim(draft.exclusions_notes),
    recommended_profile_summary: nullableTrim(draft.recommended_profile_summary),
    commercial_arguments: nullableTrim(draft.commercial_arguments),
    support_materials: materials,
  }
}

export function draftFromApiProduct(p: Record<string, unknown>): ProductCatalogDraft {
  const addRaw = Array.isArray(p.additional_coverages) ? p.additional_coverages : []
  const additional_coverages: CoverageRow[] = addRaw.map((item) => {
    if (typeof item === 'string') {
      return { title: item, detail: '' }
    }
    const o = item as Record<string, unknown>
    return {
      title: String(o.title ?? o.name ?? ''),
      detail: String(o.detail ?? o.description ?? ''),
    }
  })
  const matRaw = Array.isArray(p.support_materials) ? p.support_materials : []
  const support_materials: MaterialRow[] = matRaw.map((item) => {
    if (typeof item === 'string') {
      return { label: item, url: '' }
    }
    const o = item as Record<string, unknown>
    return {
      label: String(o.label ?? o.title ?? ''),
      url: String(o.url ?? ''),
    }
  })
  const insurer = p.insurer_id as string | null | undefined
  const strOrEmpty = (v: unknown) => (v == null || v === undefined ? '' : String(v))
  return {
    name: strOrEmpty(p.name),
    product_line: strOrEmpty(p.product_line),
    category: strOrEmpty(p.category) || 'AUTO_INSURANCE',
    description: strOrEmpty(p.description),
    risk_level: strOrEmpty(p.risk_level) || 'MEDIUM',
    target_tags: strOrEmpty(p.target_tags),
    active: Boolean(p.active ?? true),
    insurer_id: insurer ?? '',
    main_coverage_summary: strOrEmpty(p.main_coverage_summary),
    exclusions_notes: strOrEmpty(p.exclusions_notes),
    recommended_profile_summary: strOrEmpty(p.recommended_profile_summary),
    commercial_arguments: strOrEmpty(p.commercial_arguments),
    additional_coverages,
    support_materials,
  }
}
