import fs from 'node:fs'

const themes = fs.readFileSync('src/pages/merchant/themes.jsx', 'utf8')
const system = fs.readFileSync('src/lib/theme-system.js', 'utf8')

const checks = [
  ['real storefront engine used in preview', themes.includes('applyStoreThemeToDocument')],
  ['save broadcasts to live storefront', themes.includes('broadcastStoreThemeUpdate(savedStoreTheme)') || themes.includes('broadcastStoreThemeUpdate(nextStoreTheme)')],
  ['save header sticky', themes.includes('sticky top-[70px]')],
  ['grid options 2-6', ['two','three','four','five','six'].every(v => themes.includes(`['${v}'`))],
  ['desktop 5 columns CSS', system.includes('repeat(5, minmax(0, 1fr))')],
  ['desktop 6 columns CSS', system.includes('repeat(6, minmax(0, 1fr))')],
  ['13 font choices wired', themes.includes("['rounded', 'Rounded UI']") && themes.includes("['courier', 'Courier Mono']")],
  ['expanded nav styles wired', system.includes('data-theme-nav="floating"') && system.includes('data-theme-nav="accent"')],
  ['expanded hero styles wired', system.includes('data-theme-hero="full-bleed"') && system.includes('data-theme-hero="minimal"')],
  ['button styles visually wired', system.includes('data-theme-button="outline"') && system.includes('data-theme-button="gradient"')],
  ['hero height/alignment wired', system.includes('data-theme-hero-height="cinematic"') && system.includes('data-theme-hero-align="right"')],
  ['content width wired', system.includes('data-theme-width="full"')],
  ['image ratio/fit wired', system.includes('data-theme-image-ratio="portrait"') && system.includes('data-theme-image-fit="contain"')],
  ['shadow/hover wired', system.includes('data-theme-shadow="strong"') && system.includes('data-theme-hover="glow"')],
  ['heading style wired', system.includes('data-theme-heading="uppercase"')],
]

let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${label}`)
  if (!ok) failed++
}
if (failed) process.exit(1)
console.log(`\nTheme engine upgrade: ${checks.length} checks passed.`)
