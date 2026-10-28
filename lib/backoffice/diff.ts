// Flatten before/after JSON into dotted paths for a side-by-side diff.

export type DiffRow = {
  path: string;
  before: unknown;
  after: unknown;
  changed: boolean;
};

function flatten(
  value: unknown,
  prefix = "",
  out = new Map<string, unknown>(),
) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0 && prefix) out.set(prefix, {});
    for (const [k, v] of entries)
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (prefix) {
    out.set(prefix, value);
  } else if (value !== null && value !== undefined) {
    out.set("value", value);
  }
  return out;
}

export function diffJson(before: unknown, after: unknown): DiffRow[] {
  const a = flatten(before);
  const b = flatten(after);
  const paths = [...new Set([...a.keys(), ...b.keys()])].sort();
  return paths.map((path) => {
    const x = a.get(path);
    const y = b.get(path);
    return {
      path,
      before: x,
      after: y,
      changed: JSON.stringify(x) !== JSON.stringify(y),
    };
  });
}
