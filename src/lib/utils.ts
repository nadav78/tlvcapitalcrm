import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Escapes Postgres ILIKE wildcard characters (%, _) and the escape character
// itself (\) so an .ilike() filter built from user-provided text (e.g. a
// prospect company name containing "%") matches literally instead of as a
// wildcard pattern.
export function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}
