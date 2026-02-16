/**
 * Extract initials from a name string.
 * Returns up to 2 uppercase characters (first letter of first and last name).
 */
export function getInitials(name: string | undefined): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0][0]?.toUpperCase() ?? "U";
}
