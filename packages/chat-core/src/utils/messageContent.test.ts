import { describe, expect, it } from "vitest";

import { MESSAGE_MAX_LENGTH, validateMessageBody } from "./messageContent";

describe("validateMessageBody", () => {
  it("accepts regular content and trims surrounding whitespace", () => {
    const result = validateMessageBody("  hello there  ");

    expect(result.isValid).toBe(true);
    expect(result.value).toBe("hello there");
  });

  it("rejects values longer than 500 characters", () => {
    const result = validateMessageBody("a".repeat(MESSAGE_MAX_LENGTH + 1));

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("too_long");
  });

  it("rejects SQL injection-style payloads", () => {
    const result = validateMessageBody("' OR 1=1 --");

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("sql_injection");
  });
});
