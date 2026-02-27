import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(() => ({ mocked: true })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

import { createSupabaseBrowserClient } from "./client";

const ORIGINAL_ENV = { ...process.env };
const SUPABASE_URL = "https://example.supabase.co";
const SUPABASE_ANON_KEY = "anon-key";

const expectRealtimeConfig = (vsn: "1.0.0" | "2.0.0") => {
  expect(createClientMock).toHaveBeenCalledWith(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: {
      vsn,
      params: {
        eventsPerSecond: 20,
      },
    },
  });
};

describe("createSupabaseBrowserClient", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    createClientMock.mockReturnValue({ mocked: true });
    process.env = { ...ORIGINAL_ENV };
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_REALTIME_VSN;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("defaults realtime vsn to 1.0.0", () => {
    const client = createSupabaseBrowserClient();

    expect(client).toEqual({ mocked: true });
    expectRealtimeConfig("1.0.0");
  });

  it("uses realtime vsn from env when set to 2.0.0", () => {
    process.env.NEXT_PUBLIC_SUPABASE_REALTIME_VSN = "2.0.0";

    createSupabaseBrowserClient();

    expectRealtimeConfig("2.0.0");
  });

  it("falls back to 1.0.0 when realtime vsn is invalid", () => {
    process.env.NEXT_PUBLIC_SUPABASE_REALTIME_VSN = "invalid";

    createSupabaseBrowserClient();

    expectRealtimeConfig("1.0.0");
  });

  it("throws when required Supabase env vars are missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    expect(() => createSupabaseBrowserClient()).toThrow(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
