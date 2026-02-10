const HEX32_RE = /^[0-9a-fA-F]{32}$/;
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Normalize a Notion ID to standard UUID format (lowercase, with hyphens).
 * Handles 32-char hex IDs and standard UUIDs.
 * Returns null for invalid formats.
 */
export function normalizeNotionId(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();

  if (UUID_RE.test(s)) return s.toLowerCase();

  // Notion sometimes uses 32-hex IDs without hyphens
  const compact = s.replace(/-/g, '');
  if (HEX32_RE.test(compact)) {
    const h = compact.toLowerCase();
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  return null;
}

/**
 * Validate that LLM-returned IDs exist in the known valid set.
 * Normalizes all IDs before comparison.
 */
export function validateIds(
  proposedIds: string[],
  validIds: string[],
): { valid: string[]; invalid: string[] } {
  const validSet = new Set(
    validIds.map((id) => normalizeNotionId(id)).filter(Boolean) as string[],
  );

  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const raw of proposedIds) {
    const norm = normalizeNotionId(raw);
    if (!norm) {
      invalid.push(raw);
      continue;
    }
    if (seen.has(norm)) continue; // deduplicate
    seen.add(norm);

    if (validSet.has(norm)) {
      valid.push(norm);
    } else {
      invalid.push(raw);
    }
  }

  return { valid, invalid };
}

/**
 * Merge existing relation IDs with newly matched IDs, deduplicating.
 * Preserves order: existing IDs first, then new IDs.
 */
export function mergeRelationIds(
  existingIds: string[],
  newIds: string[],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of [...existingIds, ...newIds]) {
    const norm = normalizeNotionId(raw);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    result.push(norm);
  }

  return result;
}
