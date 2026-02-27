"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "text" | "icon" | "pill";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-600 dark:disabled:text-zinc-300",
  secondary:
    "rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 dark:focus-visible:ring-zinc-500",
  ghost:
    "w-full border-b border-zinc-200 px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:focus-visible:ring-zinc-500",
  text: "text-xs text-zinc-500 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:text-zinc-200 dark:focus-visible:ring-zinc-500",
  icon: "inline-flex items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 dark:focus-visible:ring-zinc-500",
  pill: "rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-md hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:ring-zinc-500",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-6",
  md: "h-11",
  lg: "h-14 w-14",
};

export const Button = ({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) => {
  const baseClasses = variantClasses[variant];
  const sizeClass =
    variant === "icon" || variant === "primary" || variant === "pill" ? sizeClasses[size] : "";

  return (
    <button
      type="button"
      className={`${baseClasses} ${sizeClass} ${className} cursor-pointer`.trim()}
      {...props}
    >
      {children}
    </button>
  );
};

interface ActiveGhostButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isActive: boolean;
  children: ReactNode;
}

export const GhostButton = ({
  isActive,
  className = "",
  children,
  ...props
}: ActiveGhostButtonProps) => {
  const activeClasses = isActive
    ? "bg-sky-50 ring-1 ring-sky-200 dark:bg-sky-900/35 dark:ring-sky-700/70"
    : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60";

  return (
    <button
      type="button"
      className={`w-full border-b border-zinc-200 px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:focus-visible:ring-zinc-500 ${activeClasses} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
};

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "circle" | "transparent";
  children: ReactNode;
}

export const IconButton = ({
  size = "md",
  variant = "default",
  className = "",
  children,
  ...props
}: IconButtonProps) => {
  const sizeClasses: Record<string, string> = {
    sm: "h-6 w-6",
    md: "h-9 w-9",
    lg: "h-14 w-14",
  };

  const variantClasses: Record<string, string> = {
    default:
      "rounded-md text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100",
    circle:
      "rounded-full bg-zinc-900 text-white shadow-lg transition hover:scale-[1.03] dark:bg-zinc-100 dark:text-zinc-900",
    transparent:
      "rounded-full border border-zinc-300 bg-white/90 text-zinc-700 shadow-sm backdrop-blur-sm transition hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/85 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:text-zinc-50",
  };

  return (
    <button
      type="button"
      className={`${sizeClasses[size]} ${variantClasses[variant]} inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
};
