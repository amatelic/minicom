import { describe, expect, it } from "vitest";

import type { Message } from "../types";
import { mergeMessages } from "./messages";

const message = (partial: Partial<Message> & { id: string; clientId: string }): Message => ({
  id: partial.id,
  clientId: partial.clientId,
  threadId: partial.threadId ?? "thread-1",
  senderId: partial.senderId ?? "visitor-1",
  senderRole: partial.senderRole ?? "visitor",
  body: partial.body ?? "message",
  createdAt: partial.createdAt ?? 1,
  seq: partial.seq ?? 1,
  deliveryState: partial.deliveryState ?? "sent",
});

describe("mergeMessages", () => {
  it("dedupes by stable client id and keeps deterministic order", () => {
    const paged = [
      message({ id: "m2", clientId: "c2", createdAt: 2, seq: 2 }),
      message({ id: "m3", clientId: "c3", createdAt: 3, seq: 3 }),
    ];
    const realtime = [
      message({ id: "m1", clientId: "c1", createdAt: 1, seq: 1 }),
      message({ id: "m2-confirmed", clientId: "c2", createdAt: 2, seq: 2 }),
    ];

    const merged = mergeMessages(paged, realtime);

    expect(merged.map((item) => item.id)).toEqual(["m1", "m2-confirmed", "m3"]);
  });

  it("does not regress sent status with stale optimistic message", () => {
    const canonical = message({ id: "m1", clientId: "c1", deliveryState: "sent" });
    const staleOptimistic = message({
      id: "optimistic-c1",
      clientId: "c1",
      deliveryState: "sending",
    });

    const merged = mergeMessages([canonical], [staleOptimistic]);

    expect(merged[0].deliveryState).toBe("sent");
    expect(merged[0].id).toBe("m1");
  });

  it("collapses optimistic and confirmed variants into one row", () => {
    const optimistic = message({
      id: "optimistic-c2",
      clientId: "c2",
      createdAt: 200,
      seq: 200,
      deliveryState: "sending",
    });
    const confirmed = message({
      id: "db-c2",
      clientId: "c2",
      createdAt: 200,
      seq: 201,
      deliveryState: "sent",
    });

    const merged = mergeMessages([optimistic], [confirmed]);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("db-c2");
    expect(merged[0].deliveryState).toBe("sent");
  });
});
