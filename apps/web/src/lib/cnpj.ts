function onlyDigits(s: string): string {
  return s.replace(/\D/g, '')
}

export function formatCnpj(value: string): string {
  const d = onlyDigits(value).slice(0, 14)
  const p1 = d.slice(0, 2)
  const p2 = d.slice(2, 5)
  const p3 = d.slice(5, 8)
  const p4 = d.slice(8, 12)
  const p5 = d.slice(12, 14)
  let out = ''
  if (p1) out += p1
  if (p2) out += `.${p2}`
  if (p3) out += `.${p3}`
  if (p4) out += `/${p4}`
  if (p5) out += `-${p5}`
  return out
}

function calcCheckDigit(base: number[], weights: number[]): number {
  const sum = base.reduce((acc, n, idx) => acc + n * weights[idx], 0)
  const mod = sum % 11
  return mod < 2 ? 0 : 11 - mod
}

export function isValidCnpj(value: string): boolean {
  const d = onlyDigits(value)
  if (d.length !== 14) return false
  // Reject sequences like 000... / 111...
  if (/^(\d)\1{13}$/.test(d)) return false
  const nums = d.split('').map((c) => Number(c))
  if (nums.some((n) => !Number.isFinite(n))) return false
  const base12 = nums.slice(0, 12)
  const dv1 = calcCheckDigit(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const base13 = [...base12, dv1]
  const dv2 = calcCheckDigit(base13, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return dv1 === nums[12] && dv2 === nums[13]
}

