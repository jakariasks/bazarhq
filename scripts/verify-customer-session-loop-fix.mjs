import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const files = {
  customerHook: path.join(root, 'src/hooks/use-customer-auth.jsx'),
  merchantHook: path.join(root, 'src/hooks/use-auth.jsx'),
  roles: path.join(root, 'src/lib/auth-roles.js'),
  login: path.join(root, 'src/pages/customer-login.jsx'),
  account: path.join(root, 'src/pages/customer-account.jsx'),
}

for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${name}: ${file}`)
}

const customerHook = fs.readFileSync(files.customerHook, 'utf8')
const merchantHook = fs.readFileSync(files.merchantHook, 'utf8')
const roles = fs.readFileSync(files.roles, 'utf8')
const login = fs.readFileSync(files.login, 'utf8')
const account = fs.readFileSync(files.account, 'utf8')

const checks = [
  [customerHook.includes("event === 'TOKEN_REFRESHED'"), 'Customer auth must ignore token refresh loading resets.'],
  [customerHook.includes('initializedRef.current'), 'Customer auth must use stable initialization state.'],
  [customerHook.includes('SESSION_RESOLUTION_TIMEOUT_MS'), 'Customer auth must have a finite resolution timeout.'],
  [merchantHook.includes("event === 'TOKEN_REFRESHED'"), 'Shared merchant auth must ignore token refresh loading resets.'],
  [roles.includes('roleRequests') && roles.includes('ROLE_CACHE_TTL_MS'), 'Role lookup must deduplicate parallel requests.'],
  [login.includes('navigate({ to: redirectTo, replace: true })'), 'Customer login must use SPA replace navigation.'],
  [!login.includes('window.location.assign(redirectTo)'), 'Customer login must not hard reload the redirect target.'],
  [account.includes('if (!loading && !rawUser)'), 'Account redirect must check the real Supabase session first.'],
  [account.includes('Customer access needs one more step'), 'Account must show recovery UI instead of bouncing to login.'],
]

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message)
if (failed.length) {
  console.error('Customer session loop fix verification failed:')
  failed.forEach((message) => console.error(`- ${message}`))
  process.exit(1)
}

console.log('BazarHQ customer login loop and slow-loading fix is installed correctly.')
