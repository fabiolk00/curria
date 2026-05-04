export type UserDisplayNameParts = {
  firstName: string
  lastName: string
}

export function getFallbackInitials(
  displayName: string | null | undefined,
  email: string | null | undefined,
  fallback = "U",
): string {
  const source = displayName?.trim() || email?.trim() || fallback
  const parts = source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((value) => value[0]?.toUpperCase() ?? "")
    .join("")

  return parts || fallback
}

export function splitDisplayName(displayName: string | null | undefined): UserDisplayNameParts {
  const parts = displayName?.trim().split(/\s+/).filter(Boolean) ?? []

  if (parts.length === 0) {
    return {
      firstName: "Nao informado",
      lastName: "Nao informado",
    }
  }

  const [firstName, ...lastNameParts] = parts

  return {
    firstName,
    lastName: lastNameParts.join(" ") || "Nao informado",
  }
}

