import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MessageComposer } from "@minicom/chat-ui";

describe("MessageComposer", () => {
  it("sends message on Enter and clears input", () => {
    const onSend = vi.fn();
    const onInputChange = vi.fn();

    render(
      <MessageComposer
        ariaLabel="visitor-message-input"
        placeholder="Write a message..."
        onSend={onSend}
        onInputChange={onInputChange}
      />,
    );

    const textarea = screen.getByLabelText("visitor-message-input");
    fireEvent.change(textarea, { target: { value: "  hello world  " } });

    expect(textarea.textContent).toBe("  hello world  ");

    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("hello world");
    expect(textarea.textContent).toBe("");
  });

  it("blocks SQL-like input and shows validation error", () => {
    const onSend = vi.fn();
    const onInputChange = vi.fn();

    render(
      <MessageComposer
        ariaLabel="visitor-message-input"
        placeholder="Write a message..."
        onSend={onSend}
        onInputChange={onInputChange}
      />,
    );

    const textarea = screen.getByLabelText("visitor-message-input");
    fireEvent.change(textarea, { target: { value: "drop table users" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByText("Message contains blocked SQL-like input.")).toBeInTheDocument();
  });
});
