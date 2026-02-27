import React from "react";
import type { Message } from "@minicom/chat-core";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { MessageBubble } from "./MessageBubble";

const message = (partial: Partial<Message> = {}): Message => ({
  id: partial.id ?? "m1",
  clientId: partial.clientId ?? "c1",
  threadId: partial.threadId ?? "thread-1",
  senderId: partial.senderId ?? "visitor-1",
  senderRole: partial.senderRole ?? "visitor",
  body: partial.body ?? "hello",
  createdAt: partial.createdAt ?? 1,
  seq: partial.seq ?? 1,
  deliveryState: partial.deliveryState ?? "sent",
});

beforeAll(() => {
  if (typeof window.matchMedia === "function") {
    return;
  }

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: "",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("MessageBubble", () => {
  it("shows retry for failed own message and calls onRetry", () => {
    const onRetry = vi.fn();

    render(
      <MessageBubble
        message={message({ deliveryState: "failed", clientId: "retry-c1", senderRole: "visitor" })}
        viewerRole="visitor"
        onRetry={onRetry}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith("retry-c1");
  });

  it("does not show retry for failed message from another participant", () => {
    const onRetry = vi.fn();

    render(
      <MessageBubble
        message={message({ deliveryState: "failed", senderRole: "agent" })}
        viewerRole="visitor"
        onRetry={onRetry}
      />,
    );

    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });
});
