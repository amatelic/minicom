"use client";

import { useEffect, useState } from "react";

interface OfflineBannerProps {
  message?: string;
}

export const OfflineBanner = ({ message }: OfflineBannerProps) => {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => {
      setOnline(window.navigator.onLine);
    };

    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);

    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (online) {
    return null;
  }

  return (
    <div className="fixed top-3 left-1/2 z-50 -translate-x-1/2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800 shadow dark:border-amber-700 dark:bg-amber-900/65 dark:text-amber-100">
      {message ?? "You are offline. Some features may be unavailable."}
    </div>
  );
};
