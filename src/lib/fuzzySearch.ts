export const normalizeSearchText = (value: string): string => {
  return value.trim().toLowerCase();
};

/**
 * Fuzzy-match with pre-normalized text and query.
 * Use this when filtering a list with the same query to avoid
 * redundant normalization on every call.
 */
export const fuzzyIncludesNormalized = (
  normalizedText: string,
  normalizedQuery: string,
): boolean => {
  if (normalizedQuery.length === 0) {
    return true;
  }

  let queryIndex = 0;
  for (const char of normalizedText) {
    if (char === normalizedQuery[queryIndex]) {
      queryIndex += 1;
      if (queryIndex === normalizedQuery.length) {
        return true;
      }
    }
  }

  return false;
};

/** Convenience wrapper that normalizes both inputs. */
export const fuzzyIncludes = (text: string, query: string): boolean => {
  return fuzzyIncludesNormalized(
    normalizeSearchText(text),
    normalizeSearchText(query),
  );
};
