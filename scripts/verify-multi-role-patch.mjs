import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const required = [
  'src/lib/auth-roles.js',
  'src/hooks/use-auth.jsx',
  'src/hooks/use-customer-auth.jsx',
  'src/components/auth-guard.jsx',
  'src/pages/login.jsx',
  'src/pages/signup.jsx',
  'src/pages/customer-login.jsx',
  'src/pages/customer-signup.jsx',
  'src/pages/merchant/layout.jsx',
  'src/pages/customer-account.jsx',
  'supabase/migrations/20260805_multi_role_accounts.sql',
]

const problems = []
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) problems.push(`Missing ${file}`)
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

if (!problems.length) {
  const migration = read('supabase/migrations/20260805_multi_role_accounts.sql')
  for (const token of [
    'create table if not exists public.user_roles',
    'create or replace function public.get_my_roles()',
    'create or replace function public.activate_my_role',
    "role in ('merchant','customer')",
  ]) {
    if (!migration.toLowerCase().includes(token.toLowerCase())) problems.push(`Migration is missing: ${token}`)
  }

  const authRoles = read('src/lib/auth-roles.js')
  if (!authRoles.includes("supabase.rpc('get_my_roles')")) problems.push('Role reads are not using get_my_roles RPC.')
  if (!authRoles.includes("supabase.rpc('activate_my_role'")) problems.push('Role activation is not using activate_my_role RPC.')

  const guard = read('src/components/auth-guard.jsx')
  if (guard.includes('Sign out and log in as a merchant') || guard.includes('Merchant account required')) {
    problems.push('Old single-role blocking UI is still present in AuthGuard.')
  }

  const customerLogin = read('src/pages/customer-login.jsx')
  const merchantLogin = read('src/pages/login.jsx')
  if (!customerLogin.includes('activateCustomerRole') && !customerLogin.includes('signIn(')) problems.push('Customer role activation flow was not found.')
  if (!merchantLogin.includes('activateMyRole(ROLE_MERCHANT')) problems.push('Merchant role activation flow was not found.')
}

if (problems.length) {
  console.error('Multi-role patch verification failed:')
  for (const problem of problems) console.error(`- ${problem}`)
  process.exit(1)
}

console.log('BazarHQ multi-role patch static verification passed.')
