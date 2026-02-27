export const createId = (prefix: string): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const readOrCreateSessionId = (key: string, prefix: string): string => {
  if (typeof window === "undefined") {
    return createId(prefix);
  }

  const existing = window.localStorage.getItem(key);
  if (existing) {
    return existing;
  }

  const created = createId(prefix);
  window.localStorage.setItem(key, created);
  return created;
};
