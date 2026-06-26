// src/pages/superadmin/themes.jsx
// A4 SRS: Theme list, activate/deactivate, set default, preview

import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { Button } from '@/components/ui/button'
import { Eye, Check, X, Palette, AlertCircle } from 'lucide-react'

// Built-in themes from the merchant theme system
const BUILTIN_THEMES = [
  { id: 'indigo', name: 'Indigo', swatch: '#4F46E5', primary: 'oklch(0.54 0.22 277)' },
  { id: 'emerald', name: 'Emerald', swatch: '#10B981', primary: 'oklch(0.60 0.17 158)' },
  { id: 'rose', name: 'Rose', swatch: '#F43F5E', primary: 'oklch(0.62 0.22 18)' },
  { id: 'amber', name: 'Amber', swatch: '#F59E0B', primary: 'oklch(0.74 0.17 70)' },
  { id: 'violet', name: 'Violet', swatch: '#8B5CF6', primary: 'oklch(0.58 0.24 300)' },
  { id: 'slate', name: 'Slate', swatch: '#334155', primary: 'oklch(0.35 0.03 260)' },
]

const DEFAULT_THEME_CONFIG = {
  activeThemes: BUILTIN_THEMES.map(t => t.id),
  defaultTheme: 'indigo',
}

function ThemeCard({
  theme,
  usageCount,
  isDefault,
  onSetDefault,
  onToggle,
  isActive,
  isFullAccess,
}) {
  const [preview, setPreview] = useState(false)

  return (
    <>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-colors">
        {/* Preview swatch */}
        <div
          className="h-32 relative cursor-pointer group"
          style={{
            background: `linear-gradient(135deg, ${theme.swatch}, ${theme.swatch}88)`,
          }}
          onClick={() => setPreview(true)}
        >
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {isDefault && (
            <div className="absolute top-2 left-2 bg-white/90 text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Check className="h-3 w-3" />
              Default
            </div>
          )}

          {!isActive && (
            <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
              Hidden
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-white">{theme.name}</h3>

            <span
              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                isActive
                  ? 'border-emerald-800 bg-emerald-900/30 text-emerald-400'
                  : 'border-gray-700 bg-gray-800 text-gray-500'
              }`}
            >
              {isActive ? 'Active' : 'Hidden'}
            </span>
          </div>

          <p className="text-xs text-gray-500 mb-3">
            {usageCount} merchant{usageCount !== 1 ? 's' : ''} using this theme
          </p>

          {isFullAccess && (
            <div className="flex gap-2">
              {!isDefault && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 border-gray-700 text-gray-300 hover:text-white text-xs"
                  onClick={() => onSetDefault(theme.id)}
                >
                  Set Default
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                className={`flex-1 text-xs ${
                  isActive
                    ? 'border-red-800 text-red-400 hover:bg-red-900/20'
                    : 'border-emerald-800 text-emerald-400 hover:bg-emerald-900/20'
                }`}
                onClick={() => onToggle(theme.id, !isActive)}
                disabled={isDefault && isActive}
              >
                {isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          )}

          {isDefault && isActive && (
            <p className="text-xs text-gray-600 mt-2 text-center">
              Default theme cannot be deactivated
            </p>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreview(false)}
        >
          <div
            className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Fake browser chrome */}
            <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-800 border-b border-gray-700">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />

              <div className="flex-1 bg-gray-700 rounded-md mx-2 px-3 py-0.5 text-xs text-gray-400">
                myshop.bazarhq.com
              </div>
            </div>

            {/* Storefront preview */}
            <div style={{ '--primary': theme.primary }} className="p-5">
              <div
                className="h-20 rounded-xl mb-4 flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${theme.swatch}, ${theme.swatch}99)`,
                }}
              >
                <p className="text-white font-bold text-lg">My Shop</p>
              </div>

              <p className="text-xs font-semibold text-gray-400 mb-2">
                Featured Products
              </p>

              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map(i => (
                  <div key={i}>
                    <div className="aspect-square bg-gray-800 rounded-lg mb-1" />
                    <div className="h-2 bg-gray-700 rounded w-3/4 mb-1" />
                    <div
                      className="h-2 rounded w-1/2"
                      style={{ backgroundColor: `${theme.swatch}66` }}
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="mt-4 w-full py-2 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: theme.swatch }}
              >
                Shop Now
              </button>
            </div>

            <div className="px-5 pb-4">
              <Button
                variant="outline"
                className="w-full border-gray-700 text-gray-300"
                onClick={() => setPreview(false)}
              >
                <X className="h-4 w-4 mr-2" />
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function ThemesPage() {
  const { writeAuditLog, isFullAccess } = useAdminAuth()

  const [themeConfig, setThemeConfig] = useState(DEFAULT_THEME_CONFIG)
  const [usageCounts, setUsageCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  async function load() {
    setLoading(true)

    const { data: stores } = await supabase.from('stores').select('theme_id')

    const counts = {}

    ;(stores || []).forEach(store => {
      const themeId = store.theme_id || 'indigo'
      counts[themeId] = (counts[themeId] || 0) + 1
    })

    setUsageCounts(counts)

    const { data: cfg } = await supabase
      .from('platform_content')
      .select('body')
      .eq('content_type', 'theme_config')
      .maybeSingle()

    if (cfg?.body) {
      try {
        const parsed = JSON.parse(cfg.body)

        setThemeConfig({
          activeThemes: Array.isArray(parsed.activeThemes)
            ? parsed.activeThemes
            : DEFAULT_THEME_CONFIG.activeThemes,
          defaultTheme: parsed.defaultTheme || DEFAULT_THEME_CONFIG.defaultTheme,
        })
      } catch {
        setThemeConfig(DEFAULT_THEME_CONFIG)
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function saveConfig(newConfig) {
    await supabase.from('platform_content').upsert(
      {
        content_type: 'theme_config',
        body: JSON.stringify(newConfig),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'content_type' },
    )
  }

  async function handleSetDefault(themeId) {
    const activeThemes = themeConfig.activeThemes.includes(themeId)
      ? themeConfig.activeThemes
      : [...themeConfig.activeThemes, themeId]

    const newConfig = {
      ...themeConfig,
      activeThemes,
      defaultTheme: themeId,
    }

    setThemeConfig(newConfig)
    await saveConfig(newConfig)
    await writeAuditLog('theme.set_default', { theme: themeId }, 'theme', themeId)

    setMsg(`"${BUILTIN_THEMES.find(t => t.id === themeId)?.name}" set as default theme.`)
    setTimeout(() => setMsg(''), 3000)
  }

  async function handleToggle(themeId, activate) {
    if (!activate && themeConfig.defaultTheme === themeId) {
      setMsg('Default theme cannot be deactivated.')
      setTimeout(() => setMsg(''), 3000)
      return
    }

    if (!activate && (usageCounts[themeId] || 0) > 0) {
      setMsg(`Cannot deactivate — ${usageCounts[themeId]} merchant(s) are using this theme.`)
      setTimeout(() => setMsg(''), 4000)
      return
    }

    const activeThemes = activate
      ? [...new Set([...themeConfig.activeThemes, themeId])]
      : themeConfig.activeThemes.filter(id => id !== themeId)

    const newConfig = {
      ...themeConfig,
      activeThemes,
    }

    setThemeConfig(newConfig)
    await saveConfig(newConfig)

    await writeAuditLog(
      activate ? 'theme.activate' : 'theme.deactivate',
      { theme: themeId },
      'theme',
      themeId,
    )

    setMsg(
      `Theme "${BUILTIN_THEMES.find(t => t.id === themeId)?.name}" ${
        activate ? 'activated' : 'deactivated'
      }.`,
    )

    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Theme Management</h1>

        <p className="text-sm text-gray-400 mt-0.5">
          Control which themes are available to merchants. Preview before making changes.
        </p>
      </div>

      {msg && (
        <div className="flex items-center gap-2 bg-violet-900/30 border border-violet-700 text-violet-300 text-sm px-4 py-3 rounded-xl">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {msg}
        </div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              className="h-64 bg-gray-900 border border-gray-800 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {BUILTIN_THEMES.map(theme => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              usageCount={usageCounts[theme.id] || 0}
              isDefault={themeConfig.defaultTheme === theme.id}
              isActive={themeConfig.activeThemes.includes(theme.id)}
              onSetDefault={handleSetDefault}
              onToggle={handleToggle}
              isFullAccess={isFullAccess}
            />
          ))}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-500">
        <Palette className="h-4 w-4 inline mr-1.5 text-gray-600" />
        Theme changes take effect immediately for new merchants. Existing merchants retain
        their current selection. To add custom themes, deploy theme assets and register them
        via the database.
      </div>
    </div>
  )
}