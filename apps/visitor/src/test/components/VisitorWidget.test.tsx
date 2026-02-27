import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VisitorWidget } from "../../components/VisitorWidget";

const useVisitorChatMock = vi.fn();

vi.mock("@minicom/chat-ui", () => ({
  RoleIcon: () => <span data-testid="role-icon" />,
  TypingBubble: () => <div data-testid="typing-bubble" />,
  VirtualizedMessageList: () => <div data-testid="virtualized-message-list" />,
  MessageComposer: ({
    onSend,
    onInputChange,
    disabled,
  }: {
    onSend: (value: string) => void;
    onInputChange: (value: string) => void;
    disabled?: boolean;
  }) => (
    <div data-testid="message-composer">
      <textarea
        aria-label="visitor-message-input"
        disabled={disabled}
        onChange={(e) => onInputChange(e.target.value)}
      />
      <button disabled={disabled} onClick={() => onSend("test message")}>
        Send
      </button>
    </div>
  ),
}));

vi.mock("../../hooks/useVisitorChat", () => ({
  useVisitorChat: (args: { widgetOpen: boolean }) => useVisitorChatMock(args),
}));

const createChatHookValue = (input?: Partial<ReturnType<typeof useVisitorChatMock>>) => ({
  ready: true,
  isPrimaryTab: true,
  threadId: "thread-1",
  messages: [],
  hasOlder: false,
  isFetchingOlder: false,
  isSending: false,
  isClearing: false,
  unreadCount: 0,
  isAgentTyping: false,
  isServiceLive: true,
  isAgentLive: true,
  sendMessage: vi.fn(async () => {}),
  retryMessage: vi.fn(async () => {}),
  clearConversation: vi.fn(async () => {}),
  onTypingInputChange: vi.fn(),
  stopTyping: vi.fn(),
  loadOlder: vi.fn(async () => {}),
  markVisitorRead: vi.fn(async () => {}),
  ...input,
});

describe("VisitorWidget", () => {
  beforeEach(() => {
    useVisitorChatMock.mockReset();
  });

  it("shows read-only warning and disables composer in secondary tabs", () => {
    useVisitorChatMock.mockReturnValue(
      createChatHookValue({
        isPrimaryTab: false,
      }),
    );

    render(<VisitorWidget />);

    fireEvent.click(screen.getByRole("button", { name: "Open support chat" }));

    expect(
      screen.getByText("This chat is active in another tab. This tab is read-only."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("visitor-message-input")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
  });

  it("keeps composer enabled in the primary tab", () => {
    useVisitorChatMock.mockReturnValue(createChatHookValue());

    render(<VisitorWidget />);

    fireEvent.click(screen.getByRole("button", { name: "Open support chat" }));

    expect(
      screen.queryByText("This chat is active in another tab. This tab is read-only."),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("visitor-message-input")).not.toBeDisabled();
  });
});
