import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(rel) {
  const full = path.join(root, rel)
  if (!fs.existsSync(full)) {
    throw new Error(`Missing file: ${rel}`)
  }
  return fs.readFileSync(full, 'utf8')
}

const functionFile = read('supabase/functions/merchant-session/index.ts')
const migrationFile = read('supabase/migrations/20260808_merchant_session_registry_repair.sql')
const apiFile = read('src/lib/merchant-security-api.js')
const suiteFile = read('src/components/merchant-security-suite.jsx')

const checks = [
  ['heartbeat avoids fragile upsert onConflict', !/upsert\s*\([^]*onConflict:\s*['"]merchant_id,auth_session_id/.test(functionFile)],
  ['heartbeat update/insert flow', /heartbeat\.lookup/.test(functionFile) && /heartbeat\.update/.test(functionFile) && /heartbeat\.insert/.test(functionFile)],
  ['registry health action', /action === ['"]health['"]/.test(functionFile)],
  ['remote revoke handling', /action === ['"]revoke['"]/.test(functionFile) && /revokedCurrent/.test(functionFile)],
  ['revoke-all handling', /action === ['"]revoke_all['"]/.test(functionFile) && /session_revoked_before/.test(functionFile)],
  ['session table repair', /create table if not exists public\.merchant_active_sessions/.test(migrationFile)],
  ['auth_session_id repair', /add column if not exists auth_session_id text/.test(migrationFile)],
  ['duplicate cleanup', /row_number\(\) over/.test(migrationFile) && /duplicate_session_pairs/.test(migrationFile)],
  ['non-partial unique session index', /create unique index if not exists merchant_active_sessions_auth_sid_uidx\s+on public\.merchant_active_sessions\(merchant_id, auth_session_id\)/m.test(migrationFile)],
  ['revoked session guard', /create or replace function public\.merchant_session_is_active/.test(migrationFile)],
  ['security events repair', /create table if not exists public\.merchant_security_events/.test(migrationFile)],
  ['service-role table ownership', /grant select, insert, update, delete\s+on table public\.merchant_active_sessions\s+to service_role/m.test(migrationFile)],
  ['frontend heartbeat API remains available', /export async function heartbeatMerchantSession/.test(apiFile)],
  ['settings forces fresh registry heartbeat', /heartbeatMerchantSession\(\{ force: true \}\)/.test(suiteFile)],
]

let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`)
  if (!ok) failed += 1
}

if (failed) {
  console.error(`\nMerchant session registry patch: ${failed} check(s) failed.`)
  process.exit(1)
}

console.log(`\nMerchant session registry patch: ${checks.length} checks passed.`)
