function parseJsonDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function normalizeFromFilter(rawFrom) {
  const date = parseJsonDate(rawFrom);
  return date ? date.toISOString() : null;
}

export function normalizeToFilter(rawTo) {
  const raw = String(rawTo || '').trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return null;
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString();
  }

  const parsed = parseJsonDate(raw);
  return parsed ? parsed.toISOString() : null;
}

export function normalizeSearch(rawSearch) {
  const search = String(rawSearch || '').trim();
  if (!search) return '';
  return search.slice(0, 120);
}

export function normalizePage(rawPage) {
  const page = Number(rawPage);
  if (!Number.isFinite(page)) return 1;
  return Math.max(1, Math.floor(page));
}

export function normalizePageSize(rawPageSize) {
  const pageSize = Number(rawPageSize);
  if (!Number.isFinite(pageSize)) return 20;
  return Math.min(100, Math.max(1, Math.floor(pageSize)));
}

export function normalizeDays(rawDays) {
  const days = Number(rawDays);
  if (!Number.isFinite(days)) return 30;
  return Math.max(7, Math.min(365, Math.floor(days)));
}

export function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function formatDay(date) {
  return date.toISOString().slice(0, 10);
}

export function resolveTrendStart(fromIso, days) {
  const byDays = addDays(new Date(), -days + 1);
  byDays.setUTCHours(0, 0, 0, 0);
  if (!fromIso) return byDays.toISOString();
  const fromDate = new Date(fromIso);
  if (Number.isNaN(fromDate.getTime())) return byDays.toISOString();
  return fromDate > byDays ? fromDate.toISOString() : byDays.toISOString();
}

export function resolveTrendEnd(toIso) {
  if (!toIso) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
  }

  const toExclusive = new Date(toIso);
  if (Number.isNaN(toExclusive.getTime())) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
  }

  // "to" filter is exclusive in SQL, so end day on chart must be previous day.
  const inclusive = new Date(toExclusive.getTime() - 1);
  inclusive.setUTCHours(0, 0, 0, 0);
  return inclusive;
}
