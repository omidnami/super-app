export interface RgbColor {
  r: number
  g: number
  b: number
}

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim()
  const shortMatch = /^#([a-f\d]{3})$/i.exec(trimmed)
  const shortValue = shortMatch?.[1]
  if (shortValue) {
    return `#${shortValue
      .split('')
      .map((character) => character + character)
      .join('')
      .toUpperCase()}`
  }
  return /^#([a-f\d]{6})$/i.test(trimmed) ? trimmed.toUpperCase() : null
}

export function hexToRgb(value: string): RgbColor | null {
  const normalized = normalizeHexColor(value)
  if (!normalized) return null
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  }
}

export function rgbToHex({ r, g, b }: RgbColor): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase()
}

export function mixColors(first: string, second: string, amount: number): string {
  const firstRgb = hexToRgb(first)
  const secondRgb = hexToRgb(second)
  if (!firstRgb || !secondRgb) return normalizeHexColor(first) || '#000000'
  const ratio = Math.max(0, Math.min(1, amount))
  return rgbToHex({
    r: firstRgb.r + (secondRgb.r - firstRgb.r) * ratio,
    g: firstRgb.g + (secondRgb.g - firstRgb.g) * ratio,
    b: firstRgb.b + (secondRgb.b - firstRgb.b) * ratio,
  })
}

function linearize(channel: number): number {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(value: string): number {
  const rgb = hexToRgb(value)
  if (!rgb) return 0
  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b)
}

export function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first)
  const secondLuminance = relativeLuminance(second)
  const lighter = Math.max(firstLuminance, secondLuminance)
  const darker = Math.min(firstLuminance, secondLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

export function readableOnColor(background: string): '#FFFFFF' | '#111827' {
  return contrastRatio(background, '#FFFFFF') >= contrastRatio(background, '#111827')
    ? '#FFFFFF'
    : '#111827'
}

export function ensureContrast(
  color: string,
  background: string,
  target = 4.5,
  direction: 'lighten' | 'darken' = 'darken',
): string {
  const normalized = normalizeHexColor(color) || '#000000'
  const destination = direction === 'lighten' ? '#FFFFFF' : '#000000'
  let result = normalized
  for (let step = 1; step <= 40; step += 1) {
    result = mixColors(normalized, destination, step / 40)
    if (contrastRatio(result, background) >= target) return result
  }
  return result
}
