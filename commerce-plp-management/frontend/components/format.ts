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
