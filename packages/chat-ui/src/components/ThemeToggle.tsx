"use client";

import { useSyncExternalStore } from "react";

import { useTheme } from "./ThemeProvider";

interface ThemeToggleProps {
  className?: string;
}

const EMPTY_SUBSCRIBE = () => () => {};

const useHasHydrated = () =>
  useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => true,
    () => false,
  );

const SunIcon = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6" />
  </svg>
);

const MoonIcon = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M20.5 13.4a8.5 8.5 0 1 1-10-10 7 7 0 1 0 10 10Z" />
  </svg>
);

export const ThemeToggle = ({ className }: ThemeToggleProps) => {
  const { theme, toggleTheme } = useTheme();
  const hasHydrated = useHasHydrated();
  const dark = hasHydrated && theme === "dark";
  const label = hasHydrated
    ? dark
      ? "Switch to light mode"
      : "Switch to dark mode"
    : "Toggle theme";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`cursor-pointer inline-flex p-3 items-center justify-center rounded-full border border-zinc-300 bg-white/90 text-zinc-700 shadow-sm backdrop-blur-sm transition hover:border-zinc-400 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/85 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:text-zinc-50 ${className ?? ""}`.trim()}
      aria-label={label}
      title={label}
    >
      {dark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
    </button>
  );
};
