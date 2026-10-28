/**
 * Postgres timestamptz text ("2026-10-28 05:00:00.123+00", "+07", "+05:30")
 * or a Date → ISO string. Text without an offset is treated as UTC.
 */
export function pgTimestampToIso(value: Date | string | null | undefined) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  let s = value.trim().replace(" ", "T");
  if (/[+-]\d{2}$/.test(s)) s = `${s}:00`;
  else if (/[+-]\d{4}$/.test(s)) s = `${s.slice(0, -2)}:${s.slice(-2)}`;
  else if (!/(Z|[+-]\d{2}:\d{2})$/.test(s)) s = `${s}Z`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
