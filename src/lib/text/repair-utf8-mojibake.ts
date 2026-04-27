const MOJIBAKE_MARKER_PATTERN = /[\u00C3\u00C2\u00E2\uFFFD]/u
const MOJIBAKE_MARKER_GLOBAL_PATTERN = /[\u00C3\u00C2\u00E2\uFFFD]/gu
const PORTUGUESE_ACCENT_PATTERN = /[\u00E1\u00E0\u00E3\u00E2\u00E9\u00EA\u00ED\u00F3\u00F4\u00F5\u00FA\u00E7\u00C1\u00C0\u00C3\u00C2\u00C9\u00CA\u00CD\u00D3\u00D4\u00D5\u00DA\u00C7]/gu

function countMatches(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0
}

function decodeLatin1BytesAsUtf8(value: string): string {
  const bytes = Uint8Array.from(Array.from(value, (char) => char.charCodeAt(0) & 0xff))
  return new TextDecoder("utf-8").decode(bytes)
}

function shouldUseDecodedCandidate(current: string, decoded: string): boolean {
  if (decoded === current) {
    return false
  }

  const currentMarkerCount = countMatches(current, MOJIBAKE_MARKER_GLOBAL_PATTERN)
  const decodedMarkerCount = countMatches(decoded, MOJIBAKE_MARKER_GLOBAL_PATTERN)

  if (decodedMarkerCount > currentMarkerCount) {
    return false
  }

  const currentAccentCount = countMatches(current, PORTUGUESE_ACCENT_PATTERN)
  const decodedAccentCount = countMatches(decoded, PORTUGUESE_ACCENT_PATTERN)

  if (decodedMarkerCount < currentMarkerCount) {
    return decodedAccentCount >= currentAccentCount
  }

  return decodedAccentCount > currentAccentCount
}

export function repairUtf8Mojibake(value: string): string {
  if (!MOJIBAKE_MARKER_PATTERN.test(value)) {
    return value
  }

  let repaired = value

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const decoded = decodeLatin1BytesAsUtf8(repaired)
    if (!shouldUseDecodedCandidate(repaired, decoded)) {
      break
    }

    repaired = decoded
  }

  return repaired
}
