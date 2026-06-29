function ipv4ToInt(ip: string) {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function matchesCidr(ip: string, cidr: string) {
  const [range, bitsText] = cidr.split('/');
  const bits = Number(bitsText);
  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range);
  if (ipInt === null || rangeInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

export function ipAllowed(ip: string, allowed: string[] | null | undefined) {
  const list = Array.isArray(allowed) ? allowed.filter(Boolean) : [];
  if (list.length === 0) return true;
  if (list.includes('*')) return true;
  return list.some((entry) => {
    const value = String(entry).trim();
    if (!value) return false;
    if (value.includes('/')) return matchesCidr(ip, value);
    return value === ip;
  });
}
