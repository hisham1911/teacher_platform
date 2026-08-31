export function normalizeJoinCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

export function extractJoinCode(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/play\/([^/?#]+)/i);
    if (match?.[1]) return normalizeJoinCode(match[1]);
  } catch {
    // Plain activity codes and relative /play/... paths are handled below.
  }

  const pathMatch = trimmed.match(/(?:^|\/)play\/([^/?#\s]+)/i);
  if (pathMatch?.[1]) return normalizeJoinCode(pathMatch[1]);

  return normalizeJoinCode(trimmed);
}
