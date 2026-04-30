/**
 * Neon HTTP driver rejects libpq-only query params (e.g. channel_binding).
 * Strip those without parsing the whole URI — `new URL(pgUrl).toString()` can
 * corrupt userinfo when passwords contain reserved characters (+, @, etc.).
 */
export function sanitizeDatabaseUrl(raw: string): string {
  let u = raw.trim();
  if ((u.startsWith('"') && u.endsWith('"')) || (u.startsWith("'") && u.endsWith("'"))) {
    u = u.slice(1, -1).trim();
  }
  const qMark = u.indexOf("?");
  if (qMark === -1) return u;

  const base = u.slice(0, qMark);
  const queryString = u.slice(qMark + 1);
  try {
    const params = new URLSearchParams(queryString);
    params.delete("channel_binding");
    const rebuilt = params.toString();
    return rebuilt ? `${base}?${rebuilt}` : base;
  } catch {
    return u.replace(/[&?]channel_binding=[^&]*/gi, "").replace(/\?$/, "");
  }
}
