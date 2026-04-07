export function currentTimestamp(): string {
  return new Date().toISOString()
}

export function createInsertTimestamps(now: string = currentTimestamp()): {
  created_at: string
  updated_at: string
} {
  return {
    created_at: now,
    updated_at: now,
  }
}

export function createCreatedAtTimestamp(now: string = currentTimestamp()): {
  created_at: string
} {
  return {
    created_at: now,
  }
}

export function createUpdatedAtTimestamp(now: string = currentTimestamp()): {
  updated_at: string
} {
  return {
    updated_at: now,
  }
}
