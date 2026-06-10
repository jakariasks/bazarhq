export const previewThemes = [
  { id: 'indigo',  name: 'Indigo',  primary: 'oklch(0.54 0.22 277)', primaryGlow: 'oklch(0.66 0.19 280)', swatch: '#4F46E5' },
  { id: 'emerald', name: 'Emerald', primary: 'oklch(0.60 0.17 158)', primaryGlow: 'oklch(0.72 0.15 160)', swatch: '#10B981' },
  { id: 'rose',    name: 'Rose',    primary: 'oklch(0.62 0.22 18)',  primaryGlow: 'oklch(0.74 0.18 22)',  swatch: '#F43F5E' },
  { id: 'amber',   name: 'Amber',   primary: 'oklch(0.74 0.17 70)',  primaryGlow: 'oklch(0.82 0.14 75)',  swatch: '#F59E0B' },
  { id: 'violet',  name: 'Violet',  primary: 'oklch(0.58 0.24 300)', primaryGlow: 'oklch(0.70 0.20 305)', swatch: '#8B5CF6' },
  { id: 'slate',   name: 'Slate',   primary: 'oklch(0.35 0.03 260)', primaryGlow: 'oklch(0.50 0.04 260)', swatch: '#334155' },
]

export const DEFAULT_THEME_ID = 'indigo'

export function getTheme(id) {
  return previewThemes.find((t) => t.id === id) ?? previewThemes[0]
}

export function themeCssVars(theme) {
  return {
    '--primary': theme.primary,
    '--primary-glow': theme.primaryGlow,
    '--ring': theme.primary,
    '--gradient-primary': `linear-gradient(135deg, ${theme.primary}, ${theme.primaryGlow})`,
  }
}
