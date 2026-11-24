const moneyFormatter = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 })
const dateFormatter = new Intl.DateTimeFormat('fa-IR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

export function formatMoney(amount: number, currency: 'IRR' = 'IRR') {
  return `${moneyFormatter.format(amount)} ${currency === 'IRR' ? 'تومان' : currency}`
}

export function formatPersianDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return dateFormatter.format(date)
}
