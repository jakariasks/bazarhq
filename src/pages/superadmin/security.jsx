import { useEffect, useMemo, useState } from 'react'
import { Copy, KeyRound, LockKeyhole, MapPin, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { callAdminFunction } from '@/lib/admin-session'
import { useAdminAuth } from '@/hooks/use-admin-auth'

function copyText(value) {
  navigator.clipboard?.writeText(value).catch(() => null)
}

export default function SuperAdminSecurity() {
  const { admin, writeAuditLog } = useAdminAuth()
  const [admins, setAdmins] = useState([])
  const [ips, setIps] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [newIp, setNewIp] = useState({ label: '', ip_value: '' })
  const [totp, setTotp] = useState({ loading: false, secret: '', otpauth_url: '', code: '', recovery_codes: [] })

  async function load() {
    setLoading(true)
    const [adminRes, ipRes, alertRes] = await Promise.all([
      supabase.from('admin_users').select('id,email,role,is_active,allowed_ips,totp_enabled,last_login_at,last_login_ip,locked_until,failed_attempts').order('email'),
      supabase.from('admin_ip_allowlist').select('*').order('created_at', { ascending: false }),
      supabase.from('admin_alert_recipients').select('*').order('email'),
    ])
    setAdmins(adminRes.data || [])
    setIps(ipRes.data || [])
    setAlerts(alertRes.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addIp(e) {
    e.preventDefault()
    if (!newIp.label.trim() || !newIp.ip_value.trim()) return alert('Label and IP/CIDR are required.')
    const { error } = await supabase.from('admin_ip_allowlist').insert({ ...newIp, created_by: admin?.email || null })
    if (error) return alert(error.message)
    await writeAuditLog?.('security.ip_allowlist.added', newIp, 'admin_ip_allowlist')
    setNewIp({ label: '', ip_value: '' })
    await load()
  }

  async function toggleIp(row) {
    await supabase.from('admin_ip_allowlist').update({ is_active: !row.is_active }).eq('id', row.id)
    await writeAuditLog?.('security.ip_allowlist.toggled', { id: row.id, is_active: !row.is_active }, 'admin_ip_allowlist', row.id)
    await load()
  }

  async function deleteIp(row) {
    if (!confirm('Remove this allowed IP/CIDR?')) return
    await supabase.from('admin_ip_allowlist').delete().eq('id', row.id)
    await writeAuditLog?.('security.ip_allowlist.deleted', { id: row.id, ip_value: row.ip_value }, 'admin_ip_allowlist', row.id)
    await load()
  }

  async function updateAdminIps(row, value) {
    const allowed_ips = value.split(',').map((v) => v.trim()).filter(Boolean)
    const { error } = await supabase.from('admin_users').update({ allowed_ips }).eq('id', row.id)
    if (error) return alert(error.message)
    await writeAuditLog?.('security.admin_ips.updated', { email: row.email, allowed_ips }, 'admin_user', row.id)
    await load()
  }

  async function startTotp() {
    setTotp((v) => ({ ...v, loading: true, recovery_codes: [] }))
    try {
      const data = await callAdminFunction('admin-totp-setup', { action: 'start' })
      setTotp((v) => ({ ...v, loading: false, secret: data.secret, otpauth_url: data.otpauth_url }))
    } catch (e) {
      setTotp((v) => ({ ...v, loading: false }))
      alert(e.message)
    }
  }

  async function confirmTotp() {
    if (!totp.secret || !totp.code) return alert('Start setup and enter the 6-digit code first.')
    setTotp((v) => ({ ...v, loading: true }))
    try {
      const data = await callAdminFunction('admin-totp-setup', { action: 'confirm', secret: totp.secret, code: totp.code })
      setTotp((v) => ({ ...v, loading: false, recovery_codes: data.recovery_codes || [], code: '' }))
      await load()
    } catch (e) {
      setTotp((v) => ({ ...v, loading: false }))
      alert(e.message)
    }
  }

  async function saveAlert(row, patch) {
    const { error } = await supabase.from('admin_alert_recipients').update(patch).eq('id', row.id)
    if (error) return alert(error.message)
    await load()
  }

  const currentAdmin = useMemo(() => admins.find((a) => a.email === admin?.email), [admins, admin])

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-violet-300">Production Security</p>
          <h1 className="mt-2 text-3xl font-black">Super Admin Security</h1>
          <p className="mt-2 text-slate-400">IP allowlist, RFC 6238 authenticator 2FA, recovery codes, and alert recipients.</p>
        </div>
        <button onClick={load} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold"><RefreshCw className="inline h-4 w-4" /> Refresh</button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black"><MapPin className="h-5 w-5" /> Global IP allowlist</h2>
          <p className="mb-4 text-sm text-slate-400">If this list has active rows, only matching IP/CIDR entries can access Super Admin functions.</p>
          <form onSubmit={addIp} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <input value={newIp.label} onChange={(e) => setNewIp((v) => ({ ...v, label: e.target.value }))} placeholder="Office / Home" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none" />
            <input value={newIp.ip_value} onChange={(e) => setNewIp((v) => ({ ...v, ip_value: e.target.value }))} placeholder="103.10.20.30 or 103.10.20.0/24" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none" />
            <button className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold"><Plus className="inline h-4 w-4" /> Add</button>
          </form>
          <div className="mt-5 space-y-3">
            {ips.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4"><div><p className="font-bold">{row.label}</p><p className="text-sm text-slate-400">{row.ip_value}</p></div><div className="flex gap-2"><button onClick={() => toggleIp(row)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${row.is_active ? 'border-emerald-500/30 text-emerald-200' : 'border-slate-500/30 text-slate-400'}`}>{row.is_active ? 'Active' : 'Off'}</button><button onClick={() => deleteIp(row)} className="rounded-xl border border-rose-500/30 px-3 py-2 text-rose-200"><Trash2 className="h-3 w-3" /></button></div></div>)}
            {!ips.length ? <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-400">No global IP allowlist yet. Add one before production.</p> : null}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black"><KeyRound className="h-5 w-5" /> Authenticator 2FA</h2>
          <p className="mb-4 text-sm text-slate-400">Use Google Authenticator, Authy, Microsoft Authenticator, or any RFC 6238 TOTP app.</p>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm text-slate-400">Current admin</p>
            <p className="font-bold">{admin?.email}</p>
            <p className={`mt-2 text-sm font-bold ${currentAdmin?.totp_enabled ? 'text-emerald-300' : 'text-amber-300'}`}>{currentAdmin?.totp_enabled ? '2FA enabled' : '2FA not enabled'}</p>
          </div>
          <div className="mt-4 grid gap-3">
            <button onClick={startTotp} disabled={totp.loading} className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold disabled:opacity-50"><LockKeyhole className="inline h-4 w-4" /> Start 2FA setup</button>
            {totp.secret ? <div className="rounded-2xl border border-white/10 bg-slate-950 p-4"><p className="text-sm text-slate-400">Secret key</p><div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2 font-mono text-sm"><span className="break-all">{totp.secret}</span><button onClick={() => copyText(totp.secret)}><Copy className="h-4 w-4" /></button></div><p className="mt-3 text-xs text-slate-500">Add this key manually in your authenticator app, then enter the 6-digit code.</p><input value={totp.code} onChange={(e) => setTotp((v) => ({ ...v, code: e.target.value }))} placeholder="123456" className="mt-3 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none" /><button onClick={confirmTotp} className="mt-3 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold"><ShieldCheck className="inline h-4 w-4" /> Confirm and enable</button></div> : null}
            {totp.recovery_codes.length ? <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4"><p className="font-bold text-amber-100">Save these recovery codes now</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{totp.recovery_codes.map((c) => <code key={c} className="rounded-xl bg-black/35 px-3 py-2 text-amber-100">{c}</code>)}</div><button onClick={() => copyText(totp.recovery_codes.join('\n'))} className="mt-3 rounded-xl border border-amber-500/30 px-3 py-2 text-sm font-bold text-amber-100">Copy all</button></div> : null}
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="mb-4 text-lg font-black">Per-admin access and alert recipients</h2>
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-xs uppercase text-slate-500"><tr><th className="p-3">Admin</th><th className="p-3">TOTP</th><th className="p-3">Allowed IPs</th><th className="p-3">Last login</th></tr></thead>
            <tbody className="divide-y divide-white/10">
              {admins.map((row) => <tr key={row.id}><td className="p-3"><p className="font-bold">{row.email}</p><p className="text-xs text-slate-500">{row.role}</p></td><td className="p-3">{row.totp_enabled ? 'Enabled' : 'Off'}</td><td className="p-3"><input defaultValue={(row.allowed_ips || []).join(', ')} onBlur={(e) => updateAdminIps(row, e.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none" placeholder="optional IP/CIDR list" /></td><td className="p-3 text-slate-400">{row.last_login_at ? new Date(row.last_login_at).toLocaleString() : '—'}<br />{row.last_login_ip || ''}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="mb-4 text-lg font-black">Admin alert emails</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {alerts.map((row) => <div key={row.id} className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="font-bold">{row.email}</p><div className="mt-3 grid gap-2 text-sm"><label><input type="checkbox" checked={row.alert_failed_login} onChange={(e) => saveAlert(row, { alert_failed_login: e.target.checked })} /> Failed login alerts</label><label><input type="checkbox" checked={row.alert_system_outage} onChange={(e) => saveAlert(row, { alert_system_outage: e.target.checked })} /> System outage alerts</label><label><input type="checkbox" checked={row.alert_reports} onChange={(e) => saveAlert(row, { alert_reports: e.target.checked })} /> Report delivery alerts</label></div></div>)}
        </div>
      </section>
    </div>
  )
}
