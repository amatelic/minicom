import { createId } from "./ids";

export const TAB_ID_STORAGE_KEY = "minicom:visitor-tab-id";
export const ACTIVE_TAB_LOCK_STORAGE_KEY = "minicom:visitor-active-tab-lock";
export const LOCK_TTL_MS = 15_000;
export const LOCK_REFRESH_MS = 4_000;

export interface VisitorTabLock {
  ownerTabId: string;
  expiresAt: number;
}

const isValidLock = (value: unknown): value is VisitorTabLock => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<VisitorTabLock>;
  return (
    typeof candidate.ownerTabId === "string" &&
    candidate.ownerTabId.length > 0 &&
    typeof candidate.expiresAt === "number" &&
    Number.isFinite(candidate.expiresAt)
  );
};

const removeLock = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ACTIVE_TAB_LOCK_STORAGE_KEY);
};

export const getOrCreateTabId = (): string => {
  if (typeof window === "undefined") {
    return createId("visitor-tab");
  }

  const existing = window.sessionStorage.getItem(TAB_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = createId("visitor-tab");
  window.sessionStorage.setItem(TAB_ID_STORAGE_KEY, created);
  return created;
};

export const readLock = (): VisitorTabLock | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(ACTIVE_TAB_LOCK_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isValidLock(parsed)) {
      removeLock();
      return null;
    }

    return parsed;
  } catch {
    removeLock();
    return null;
  }
};

export const writeLock = (lock: VisitorTabLock | null): void => {
  if (typeof window === "undefined") {
    return;
  }

  if (!lock) {
    removeLock();
    return;
  }

  window.localStorage.setItem(ACTIVE_TAB_LOCK_STORAGE_KEY, JSON.stringify(lock));
};

export const tryAcquireOrRefreshLock = (tabId: string, now: number = Date.now()): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  const current = readLock();
  const ownsCurrentLock = current?.ownerTabId === tabId;
  const lockIsExpired = current ? current.expiresAt <= now : true;

  if (!ownsCurrentLock && !lockIsExpired) {
    return false;
  }

  writeLock({
    ownerTabId: tabId,
    expiresAt: now + LOCK_TTL_MS,
  });

  const confirmed = readLock();
  return Boolean(confirmed && confirmed.ownerTabId === tabId && confirmed.expiresAt > now);
};

export const releaseLockIfOwner = (tabId: string): void => {
  if (typeof window === "undefined") {
    return;
  }

  const current = readLock();
  if (!current || current.ownerTabId !== tabId) {
    return;
  }

  removeLock();
};
