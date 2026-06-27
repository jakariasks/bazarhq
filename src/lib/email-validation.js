const DISPOSABLE_EMAIL_DOMAINS = new Set([
  '10minutemail.com',
  '10minutemail.net',
  'tempmail.com',
  'temp-mail.org',
  'guerrillamail.com',
  'guerrillamail.net',
  'mailinator.com',
  'yopmail.com',
  'sharklasers.com',
  'getairmail.com',
  'trashmail.com',
  'fakeinbox.com',
  'dispostable.com',
  'maildrop.cc',
  'moakt.com',
  'throwawaymail.com',
  'emailondeck.com',
  'mintemail.com',
])

const COMMON_TYPO_DOMAINS = {
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'yaho.com': 'yahoo.com',
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

export function validateRealEmail(value) {
  const email = normalizeEmail(value)

  if (!email) {
    return { ok: false, email, message: 'Email is required.' }
  }

  const basicPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  if (!basicPattern.test(email)) {
    return { ok: false, email, message: 'Enter a valid email address.' }
  }

  const [local, domain] = email.split('@')
  if (!local || !domain) {
    return { ok: false, email, message: 'Enter a valid email address.' }
  }

  if (local.length < 2 || local.length > 64 || domain.length > 253) {
    return { ok: false, email, message: 'Enter a valid email address.' }
  }

  if (local.includes('..') || domain.includes('..')) {
    return { ok: false, email, message: 'Email address looks invalid.' }
  }

  if (COMMON_TYPO_DOMAINS[domain]) {
    return {
      ok: false,
      email,
      message: `Did you mean ${local}@${COMMON_TYPO_DOMAINS[domain]}?`,
    }
  }

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return {
      ok: false,
      email,
      message: 'Temporary or disposable email addresses are not allowed.',
    }
  }

  return { ok: true, email, message: '' }
}
