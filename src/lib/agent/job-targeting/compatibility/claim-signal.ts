export function canonicalizeClaimSignal(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function containsCanonicalClaimSignal(source: string, signal: string): boolean {
  const canonicalSource = canonicalizeClaimSignal(source)
  const canonicalSignal = canonicalizeClaimSignal(signal)

  return canonicalSignal.length > 0 && canonicalSource.includes(canonicalSignal)
}

export function uniqueByCanonicalClaimSignal(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const trimmed = value.trim()
    const canonical = canonicalizeClaimSignal(trimmed)

    if (!trimmed || !canonical || seen.has(canonical)) {
      continue
    }

    seen.add(canonical)
    result.push(trimmed)
  }

  return result
}
