export interface AccentPreset {
  id: string
  label: string
  color: string
}

export const DEFAULT_ACCENT_COLOR = '#F97316'

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'orange', label: 'نارنجی', color: DEFAULT_ACCENT_COLOR },
  { id: 'blue', label: 'آبی', color: '#2563EB' },
  { id: 'violet', label: 'بنفش', color: '#7C3AED' },
  { id: 'emerald', label: 'سبز', color: '#059669' },
  { id: 'rose', label: 'صورتی', color: '#E11D48' },
]

export function findAccentPreset(color: string): AccentPreset | undefined {
  const normalized = color.toUpperCase()
  return ACCENT_PRESETS.find((preset) => preset.color.toUpperCase() === normalized)
}
