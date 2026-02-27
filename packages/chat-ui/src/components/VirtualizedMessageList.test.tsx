import React from "react";
import { mergeMessages, type Message } from "@minicom/chat-core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VirtualizedMessageList } from "./VirtualizedMessageList";

const mockUseVirtualizer = vi.fn();

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (args: unknown) => mockUseVirtualizer(args),
}));

const message = (partial: Partial<Message>): Message => ({
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

beforeEach(() => {
  mockUseVirtualizer.mockImplementation((input: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: input.count }, (_, index) => ({
        index,
        start: index * 72,
      })),
    getTotalSize: () => input.count * 72,
    scrollToIndex: vi.fn(),
    measureElement: vi.fn(),
  }));
});

describe("VirtualizedMessageList", () => {
  const setScrollTop = (element: HTMLElement, value: number) => {
    Object.defineProperty(element, "scrollTop", {
      value,
      configurable: true,
      writable: true,
    });
  };

  it("does not render duplicate bubble across optimistic to confirmed transition", () => {
    const onLoadOlder = vi.fn();
    const optimistic = message({
      id: "optimistic-c1",
      clientId: "c1",
      body: "Hello there",
      deliveryState: "sending",
    });
    const confirmed = message({
      id: "db-c1",
      clientId: "c1",
      body: "Hello there",
      deliveryState: "sent",
      seq: 2,
    });

    const { rerender } = render(
      <VirtualizedMessageList
        ariaLabel="Thread history"
        messages={[optimistic]}
        viewerRole="visitor"
        hasOlder={false}
        isFetchingOlder={false}
        onLoadOlder={onLoadOlder}
      />,
    );

    rerender(
      <VirtualizedMessageList
        ariaLabel="Thread history"
        messages={mergeMessages([optimistic], [confirmed])}
        viewerRole="visitor"
        hasOlder={false}
        isFetchingOlder={false}
        onLoadOlder={onLoadOlder}
      />,
    );

    const log = screen.getByRole("log", { name: "Thread history" });
    expect(within(log).getAllByText("Hello there")).toHaveLength(1);
  });

  it("does not call onLoadOlder during initial programmatic positioning", () => {
    const onLoadOlder = vi.fn();
    const messages = Array.from({ length: 30 }, (_, index) =>
      message({
        id: `m-${index}`,
        clientId: `c-${index}`,
        seq: index,
        createdAt: index,
      }),
    );

    render(
      <VirtualizedMessageList
        ariaLabel="Thread history"
        messages={messages}
        viewerRole="visitor"
        hasOlder
        isFetchingOlder={false}
        onLoadOlder={onLoadOlder}
      />,
    );

    const log = screen.getByRole("log", { name: "Thread history" });
    setScrollTop(log, 0);
    fireEvent.scroll(log);

    expect(onLoadOlder).not.toHaveBeenCalled();
  });

  it("calls onLoadOlder after user interaction and upward top scroll", () => {
    const onLoadOlder = vi.fn();
    const messages = Array.from({ length: 30 }, (_, index) =>
      message({
        id: `m-${index}`,
        clientId: `c-${index}`,
        seq: index,
        createdAt: index,
      }),
    );

    render(
      <VirtualizedMessageList
        ariaLabel="Thread history"
        messages={messages}
        viewerRole="visitor"
        hasOlder
        isFetchingOlder={false}
        onLoadOlder={onLoadOlder}
      />,
    );

    const log = screen.getByRole("log", { name: "Thread history" });
    fireEvent.wheel(log);

    setScrollTop(log, 200);
    fireEvent.scroll(log);

    setScrollTop(log, 100);
    fireEvent.scroll(log);

    expect(onLoadOlder).toHaveBeenCalledTimes(1);
  });

  it("does not call onLoadOlder when scrolling downward at top threshold", () => {
    const onLoadOlder = vi.fn();
    const messages = Array.from({ length: 30 }, (_, index) =>
      message({
        id: `m-${index}`,
        clientId: `c-${index}`,
        seq: index,
        createdAt: index,
      }),
    );

    render(
      <VirtualizedMessageList
        ariaLabel="Thread history"
        messages={messages}
        viewerRole="visitor"
        hasOlder
        isFetchingOlder={false}
        onLoadOlder={onLoadOlder}
      />,
    );

    const log = screen.getByRole("log", { name: "Thread history" });
    fireEvent.wheel(log);

    setScrollTop(log, 90);
    fireEvent.scroll(log);

    setScrollTop(log, 100);
    fireEvent.scroll(log);

    expect(onLoadOlder).not.toHaveBeenCalled();
  });
});
