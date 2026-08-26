import { describe, expect, it } from "vitest";

import { resolveDisplayTabs } from "@/features/video-output/lib/streaming/resolve-display-tabs";

import type { TabEntry } from "@vie/types";

function tabs(n: number, prefix = "t"): TabEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i}`,
    label: `Tab ${i}`,
    emoji: "",
    component: "display_section",
    props: {},
  })) as TabEntry[];
}

describe("resolveDisplayTabs", () => {
  it("should prefer stream tabs while the video is processing", () => {
    const stream = tabs(2, "s");
    const db = tabs(5, "d");

    const result = resolveDisplayTabs({
      streamTabs: stream,
      dbTabs: db,
      videoStatus: "processing",
    });

    expect(result).toBe(stream);
  });

  it("should prefer the completed DB doc over a partial stream", () => {
    const stream = tabs(2, "s");
    const db = tabs(5, "d");

    const result = resolveDisplayTabs({
      streamTabs: stream,
      dbTabs: db,
      videoStatus: "completed",
    });

    expect(result).toBe(db);
  });

  it("should keep stream tabs when they defensively exceed a completed doc", () => {
    const stream = tabs(6, "s");
    const db = tabs(4, "d");

    const result = resolveDisplayTabs({
      streamTabs: stream,
      dbTabs: db,
      videoStatus: "completed",
    });

    expect(result).toBe(stream);
  });

  it("should fall back to DB tabs when nothing streamed", () => {
    const db = tabs(3, "d");

    const result = resolveDisplayTabs({
      streamTabs: [],
      dbTabs: db,
      videoStatus: "processing",
    });

    expect(result).toBe(db);
  });

  it("should return null when neither source has tabs", () => {
    const result = resolveDisplayTabs({
      streamTabs: [],
      dbTabs: null,
      videoStatus: undefined,
    });

    expect(result).toBeNull();
  });
});
