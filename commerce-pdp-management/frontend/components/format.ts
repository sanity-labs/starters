import type {Money} from '@starter/commerce/types'

export function formatMoney(money: Money): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: money.currencyCode || 'USD',
    }).format(money.amount)
  } catch {
    return `$${money.amount.toFixed(2)}`
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  care: 'Care',
  fit: 'Fit',
  lifestyle: 'Lifestyle',
  spec: 'Spec',
  launch: 'Launch',
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category
}
