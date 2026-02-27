import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTypingController, TYPING_DEBOUNCE_MS, TYPING_IDLE_MS } from "./typingController";

describe("typingController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not emit typing=true before 300ms debounce", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);

    const controller = createTypingController({
      threadId: "thread-1",
      participantId: "visitor-1",
      canEmit: true,
      publish,
    });

    controller.onInputChange("hello");

    await vi.advanceTimersByTimeAsync(TYPING_DEBOUNCE_MS - 1);
    expect(publish).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        threadId: "thread-1",
        isTyping: true,
      }),
    );

    controller.destroy();
  });

  it("emits typing=false after 3s inactivity", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);

    const controller = createTypingController({
      threadId: "thread-1",
      participantId: "visitor-1",
      canEmit: true,
      publish,
    });

    controller.onInputChange("hello");

    await vi.advanceTimersByTimeAsync(TYPING_DEBOUNCE_MS);
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ isTyping: true }));

    await vi.advanceTimersByTimeAsync(TYPING_IDLE_MS);
    expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({ isTyping: false }));

    controller.destroy();
  });

  it("forces typing clear when liveness gate flips to false", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);

    const controller = createTypingController({
      threadId: "thread-1",
      participantId: "visitor-1",
      canEmit: true,
      publish,
    });

    controller.onInputChange("hello");
    await vi.advanceTimersByTimeAsync(TYPING_DEBOUNCE_MS);

    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ isTyping: true }));

    controller.setCanEmit(false);

    expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({ isTyping: false }));

    controller.destroy();
  });
});
