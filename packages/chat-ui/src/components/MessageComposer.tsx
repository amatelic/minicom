"use client";

import { MESSAGE_MAX_LENGTH, validateMessageBody } from "@minicom/chat-core";
import { useState } from "react";

import { Button } from "./Button";

interface MessageComposerProps {
  ariaLabel: string;
  placeholder: string;
  disabled?: boolean;
  onSend: (value: string) => void;
  onInputChange: (value: string) => void;
}

export const MessageComposer = ({
  ariaLabel,
  placeholder,
  disabled,
  onSend,
  onInputChange,
}: MessageComposerProps) => {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const send = () => {
    const validation = validateMessageBody(value);
    if (!validation.isValid) {
      if (validation.reason === "too_long") {
        setError(`Message must be ${MESSAGE_MAX_LENGTH} characters or fewer.`);
      } else if (validation.reason === "sql_injection") {
        setError("Message contains blocked SQL-like input.");
      } else {
        setError(null);
      }
      return;
    }

    onSend(validation.value);
    setValue("");
    setError(null);
    onInputChange("");
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.target.value.slice(0, MESSAGE_MAX_LENGTH);
    setValue(newValue);
    onInputChange(newValue);
    if (error) {
      setError(null);
    }
  };

  return (
    <div className="sticky bottom-0 z-10 border-t border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
      <label htmlFor={ariaLabel} className="sr-only">
        {ariaLabel}
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id={ariaLabel}
          value={value}
          disabled={disabled}
          maxLength={MESSAGE_MAX_LENGTH}
          placeholder={placeholder}
          className="min-h-[44px] flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:disabled:bg-zinc-800"
          onChange={handleChange}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />
        <Button variant="primary" size="md" disabled={disabled || !value.trim()} onClick={send}>
          Send
        </Button>
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px]">
        <span
          className={`min-h-[1rem] ${error ? "text-red-600 dark:text-red-400" : "text-zinc-400 dark:text-zinc-500"}`}
          aria-live="polite"
        >
          {error ?? ""}
        </span>
        <span className="text-zinc-400 dark:text-zinc-500">
          {value.length}/{MESSAGE_MAX_LENGTH}
        </span>
      </div>
    </div>
  );
};
