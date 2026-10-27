const hits = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now();

  for (const [k, times] of hits) {
    const recent = times.filter((t) => now - t < windowMs);
    if (recent.length === 0) hits.delete(k);
    else if (recent.length !== times.length) hits.set(k, recent);
  }

  const times = hits.get(key) ?? [];
  if (times.length >= max) return false;

  times.push(now);
  hits.set(key, times);
  return true;
}
