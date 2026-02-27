import {
  ACTIVE_TAB_LOCK_STORAGE_KEY,
  getOrCreateTabId,
  LOCK_TTL_MS,
  readLock,
  releaseLockIfOwner,
  TAB_ID_STORAGE_KEY,
  tryAcquireOrRefreshLock,
  writeLock,
} from "./visitorTabLock";

const createMemoryStorage = () => {
  const storage = new Map<string, string>();

  return {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
  };
};

describe("visitorTabLock", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createMemoryStorage(),
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: createMemoryStorage(),
    });

    window.localStorage.removeItem(ACTIVE_TAB_LOCK_STORAGE_KEY);
    window.sessionStorage.removeItem(TAB_ID_STORAGE_KEY);
  });

  it("acquires lock for first tab and rejects second tab while lock is active", () => {
    const now = 10_000;
    expect(tryAcquireOrRefreshLock("tab-1", now)).toBe(true);
    expect(tryAcquireOrRefreshLock("tab-2", now + 100)).toBe(false);
    expect(readLock()).toEqual({
      ownerTabId: "tab-1",
      expiresAt: now + LOCK_TTL_MS,
    });
  });

  it("allows takeover after lock expiration", () => {
    const now = 10_000;
    writeLock({
      ownerTabId: "tab-1",
      expiresAt: now - 1,
    });

    expect(tryAcquireOrRefreshLock("tab-2", now)).toBe(true);
    expect(readLock()).toEqual({
      ownerTabId: "tab-2",
      expiresAt: now + LOCK_TTL_MS,
    });
  });

  it("releases lock only for the lock owner", () => {
    expect(tryAcquireOrRefreshLock("tab-1", 1_000)).toBe(true);

    releaseLockIfOwner("tab-2");
    expect(readLock()?.ownerTabId).toBe("tab-1");

    releaseLockIfOwner("tab-1");
    expect(readLock()).toBeNull();
  });

  it("clears malformed lock payload and recovers", () => {
    window.localStorage.setItem(ACTIVE_TAB_LOCK_STORAGE_KEY, "{invalid-json");
    expect(readLock()).toBeNull();
    expect(window.localStorage.getItem(ACTIVE_TAB_LOCK_STORAGE_KEY)).toBeNull();

    window.localStorage.setItem(ACTIVE_TAB_LOCK_STORAGE_KEY, JSON.stringify({ foo: "bar" }));
    expect(tryAcquireOrRefreshLock("tab-1", 5_000)).toBe(true);
    expect(readLock()?.ownerTabId).toBe("tab-1");
  });

  it("creates and reuses one tab id per browser tab session", () => {
    const first = getOrCreateTabId();
    const second = getOrCreateTabId();
    expect(first).toBe(second);
  });
});
