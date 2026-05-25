const normalizeSearchText = (value: string): string => {
  return value.trim().toLowerCase();
};

export const fuzzyIncludes = (text: string, query: string): boolean => {
  const normalizedText = normalizeSearchText(text);
  const normalizedQuery = normalizeSearchText(query);

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
