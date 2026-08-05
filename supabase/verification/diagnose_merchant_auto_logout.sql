-- Run while investigating merchant auto logout. This query does not expose tokens.

select
  p.id as merchant_id,
  p.email,
  p.session_revoked_before,
  case
    when p.session_revoked_before > now() + interval '5 minutes' then 'WARNING: future revocation timestamp'
    when p.session_revoked_before is null then 'No global revocation timestamp'
    else 'Global revocation timestamp exists'
  end as revocation_state
from public.profiles p
order by p.updated_at desc nulls last
limit 20;

select
  merchant_id,
  left(auth_session_id, 8) || '…' as session_id_masked,
  device_label,
  browser_name,
  os_name,
  ip_address,
  last_seen_at,
  access_expires_at,
  revoked_at,
  revocation_reason
from public.merchant_active_sessions
order by last_seen_at desc
limit 50;

select
  merchant_id,
  event_type,
  created_at,
  details
from public.merchant_security_events
where event_type in ('session_revoked', 'all_sessions_revoked')
order by created_at desc
limit 50;
