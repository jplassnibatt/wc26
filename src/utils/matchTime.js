// The schedule stores kickoffs in Portugal time (UTC+1 for the whole
// tournament — June/July are always WEST in Lisbon). User-facing code derives
// the absolute instant from that and formats it in the viewer's timezone, so
// players travelling abroad see their own local time.
const PT_OFFSET_HOURS = 1;

export function kickoffMs(match) {
  if (!match?.date || !match?.kickoff_bst) return null;
  const [y, mo, d] = match.date.split('-').map(Number);
  const [hh, mm] = match.kickoff_bst.split(':').map(Number);
  if ([y, mo, d, hh, mm].some(Number.isNaN)) return null;
  return Date.UTC(y, mo - 1, d, hh - PT_OFFSET_HOURS, mm);
}

export function kickoffDate(match) {
  const ms = kickoffMs(match);
  return ms == null ? null : new Date(ms);
}

export function kickoffTimeStr(match) {
  const d = kickoffDate(match);
  if (!d) return match?.kickoff_bst ?? '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mi}`;
}

export function kickoffDateStr(match, locale, options) {
  const d = kickoffDate(match);
  return d ? d.toLocaleDateString(locale, options) : '';
}

// YYYY-MM-DD in the viewer's timezone, for grouping matches into days.
export function localDateKey(match) {
  const d = kickoffDate(match);
  if (!d) return match?.date ?? '';
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function viewerTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}
