import { describe, it, expect } from "vitest";
import { shouldOpenStreamForStatus } from "../should-open-stream";

describe("shouldOpenStreamForStatus", () => {
  it("opens for processing status", () => {
    expect(shouldOpenStreamForStatus("processing")).toBe(true);
  });

  it("opens for pending status (cold start triggers fresh pipeline)", () => {
    expect(shouldOpenStreamForStatus("pending")).toBe(true);
  });

  it("does NOT open for completed status (cached output is the source of truth)", () => {
    expect(shouldOpenStreamForStatus("completed")).toBe(false);
  });

  it("does NOT open for failed status (explicit Retry button is the UX)", () => {
    expect(shouldOpenStreamForStatus("failed")).toBe(false);
  });

  it("fails safe on undefined status (record hasn't loaded yet)", () => {
    expect(shouldOpenStreamForStatus(undefined)).toBe(false);
  });

  it("fails safe on null status", () => {
    expect(shouldOpenStreamForStatus(null)).toBe(false);
  });

  it("fails safe on empty string", () => {
    expect(shouldOpenStreamForStatus("")).toBe(false);
  });

  it("fails safe on unknown status (forward-compat)", () => {
    expect(shouldOpenStreamForStatus("queued")).toBe(false);
    expect(shouldOpenStreamForStatus("archived")).toBe(false);
  });
});
