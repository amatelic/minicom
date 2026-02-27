"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ACTIVE_TAB_LOCK_STORAGE_KEY,
  getOrCreateTabId,
  LOCK_REFRESH_MS,
  releaseLockIfOwner,
  tryAcquireOrRefreshLock,
} from "../lib/visitorTabLock";

export interface UseVisitorTabLockResult {
  isPrimaryTab: boolean;
  lockReady: boolean;
}

export const useVisitorTabLock = (): UseVisitorTabLockResult => {
  const tabIdRef = useRef<string | null>(null);
  const [isPrimaryTab, setIsPrimaryTab] = useState(true);
  const [lockReady, setLockReady] = useState(false);

  const resolveOwnership = useCallback(() => {
    const tabId = tabIdRef.current;
    if (!tabId) {
      return false;
    }

    return tryAcquireOrRefreshLock(tabId);
  }, []);

  const syncOwnership = useCallback(() => {
    setIsPrimaryTab(resolveOwnership());
  }, [resolveOwnership]);

  useEffect(() => {
    const tabId = getOrCreateTabId();
    tabIdRef.current = tabId;

    const initTimer = window.setTimeout(() => {
      syncOwnership();
      setLockReady(true);
    }, 0);

    const refreshTimer = window.setInterval(() => {
      syncOwnership();
    }, LOCK_REFRESH_MS);

    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== ACTIVE_TAB_LOCK_STORAGE_KEY) {
        return;
      }

      syncOwnership();
    };

    const release = () => {
      if (tabIdRef.current) {
        releaseLockIfOwner(tabIdRef.current);
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("pagehide", release);
    window.addEventListener("beforeunload", release);

    return () => {
      window.clearTimeout(initTimer);
      window.clearInterval(refreshTimer);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pagehide", release);
      window.removeEventListener("beforeunload", release);
      release();
    };
  }, [syncOwnership]);

  return { isPrimaryTab, lockReady };
};
