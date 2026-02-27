import React from "react";
import type { InboxThread, Message, Thread } from "@minicom/chat-core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InboxList } from "../../components/InboxList";

const makeThread = (index: number): Thread => ({
  id: `thread-${index}`,
  status: "open",
  createdAt: 1_000 + index,
  updatedAt: 2_000 + index,
});

const makeMessage = (threadId: string, index: number): Message => ({
  id: `message-${index}`,
  clientId: `client-${index}`,
  threadId,
  senderId: "visitor-1",
  senderRole: "visitor",
  body: `Message ${index}`,
  createdAt: 2_000 + index,
  seq: index,
  deliveryState: "sent",
});

const makeInboxItem = (index: number): InboxThread => {
  const thread = makeThread(index);
  return {
    thread,
    unreadCount: index % 2 === 0 ? 0 : 1,
    lastMessage: makeMessage(thread.id, index),
  };
};

describe("InboxList", () => {
  it("ArrowDown moves focus to next thread, Enter selects it", () => {
    const items = [makeInboxItem(1), makeInboxItem(2), makeInboxItem(3)];
    const onSelect = vi.fn();

    render(<InboxList items={items} activeThreadId={items[0].thread.id} onSelect={onSelect} />);

    const list = screen.getByLabelText("Agent inbox list");
    list.focus();
    expect(list).toHaveFocus();

    // ArrowDown moves focus to next item
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(onSelect).not.toHaveBeenCalled();

    // Enter selects the focused item
    fireEvent.keyDown(list, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(items[1].thread.id);
  });

  it("ArrowUp at top stays bounded, Enter selects first", () => {
    const items = [makeInboxItem(1), makeInboxItem(2), makeInboxItem(3)];
    const onSelect = vi.fn();

    render(<InboxList items={items} activeThreadId={items[0].thread.id} onSelect={onSelect} />);

    const list = screen.getByLabelText("Agent inbox list");
    list.focus();
    expect(list).toHaveFocus();

    // ArrowUp at top stays at index 0
    fireEvent.keyDown(list, { key: "ArrowUp" });
    expect(onSelect).not.toHaveBeenCalled();

    // Enter selects the first item
    fireEvent.keyDown(list, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(items[0].thread.id);
  });
});
