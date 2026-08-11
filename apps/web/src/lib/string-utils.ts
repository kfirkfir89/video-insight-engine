/**
 * Extract initials for an avatar. Tries `name` first (2 chars if two words,
 * otherwise 1), then falls back to the first letter of `email`, then "U".
 *
 * The email fallback exists because newly registered users often have a
 * blank display name until they edit their profile — a faceless generic
 * icon at the first login moment reads as "your account isn't ready."
 */
export function getInitials(
  name: string | null | undefined,
  email?: string | null,
): string {
  const trimmedName = name?.trim();
  if (trimmedName) {
    const parts = trimmedName.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  const trimmedEmail = email?.trim();
  if (trimmedEmail) {
    return trimmedEmail[0].toUpperCase();
  }
  return "U";
}

/** Format seconds into h:mm:ss or m:ss timestamp string. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return "--:--";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Format seconds into human-readable "Xm Ys" string. */
export function formatDurationHuman(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

/** Relative time string from an ISO date (e.g. "5m ago", "3d ago"). */
export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/** Regex matching a leading emoji (Emoji_Presentation or Extended_Pictographic) + optional VS16 + whitespace. */
const LEADING_EMOJI_RE = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]\uFE0F?\s*/u;

/** Strip a leading emoji + whitespace from a label string. */
export function stripLeadingEmoji(label: string): string {
  return label.replace(LEADING_EMOJI_RE, '');
}
